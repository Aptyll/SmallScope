// Softfall - a 3v3 MOBA in the snow.
'use strict';
// The last file to load: the boot order, window.DBG and the
// requestAnimationFrame loop. The eagle drop it starts is js/sim/eagle.js.

// ------------------------------------------------------------ boot
// A script that never arrived (window.BOOT_MISSED, index.html) leaves its names
// undefined, and the match would crash in whatever reads one first (a missed
// js/baked/soldiers.js threw in drawRobot at the first wave). So boot stops
// here: the page loads again once, and if the file is still missing it says
// which, plainly, in English (js/app/text.js may be the one that's missing).
const BOOT_RETRY_KEY = 'softfall.bootRetry';
function bootMissed(missed) {
  let tried = false;
  try { tried = sessionStorage.getItem(BOOT_RETRY_KEY) === '1'; sessionStorage.setItem(BOOT_RETRY_KEY, '1'); } catch (e) { tried = true; }
  if (!tried) { location.reload(); return; }
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;color:#d6dde8;font:16px monospace;text-align:center;white-space:pre';
  msg.textContent = 'Softfall could not load ' + missed.join(', ') + '\nReload the page to try again.';
  document.body.appendChild(msg);
}
if (window.BOOT_MISSED.length) {
  bootMissed(window.BOOT_MISSED);
  throw new Error('boot stopped: ' + window.BOOT_MISSED.join(', ') + ' did not load');
}
try { sessionStorage.removeItem(BOOT_RETRY_KEY); } catch (e) { }

function startGame() {
  SFX.unlock();
  beginMatch();
}

PROFILE.load();   // the profile carries the settings, so it is read first
PROFILE.refundRetired(SKIN_RETIRED, SKIN_RETIRED_SLOTS); // coins back for cosmetics no longer sold (js/ui/skins.js)
// the profile's settings put in force: at boot, and again when Steam Cloud
// hands over newer ones from another PC (PROFILE.cloudSync, below)
function applySettings() {
  loadSettings();
  mendBinds(); // the profile's key binds made whole (input.js)
  fitCanvas(); relayout(); // the window may have changed size while the scripts loaded (no resize listener yet), and UI SIZE is the profile's; this places the UI for the fitted view
  SFX.setVolume(settings.volume);
  SFX.setMusicVolume(settings.musicVol);
  SFX.setSfxVolume(settings.sfxVol);
  SFX.setMuted(settings.muted);
}
applySettings();
PROFILE.cloudSync(SETTINGS_LOCAL).then((got) => { if (got) applySettings(); });
// the title track. Browsers refuse audio before a gesture, so SFX.music holds
// this as pending and the first click or keypress starts it (see js/app/audio.js).
SFX.music.play('intro', { in: 1.5 });
genWorld();        // the field: lanes, walls, pits and woods from one distance (js/sim/field.js)
placeTowers();     // ...two towers a lane a side (js/sim/towers.js)
placeStalls();     // ...each side's merchant stall (js/sim/robots.js)
placeCamps();      // ...the camps' props on their sites
placePumps();      // ...and the two gold pumps in the jungle (js/sim/pumps.js)
spawnOrca();       // ...and the orca under its lake (js/sim/orca.js)
stockCamps();      // the monsters go in once the world is standing
layDrifts();         // the snow's depth, in the lee of everything worldgen stood up (js/sim/depth.js)
initPlayers();
// on Steam, a name the player never chose becomes their Steam name (PROFILE.steamName),
// and the copy's first purchase decides the FOUNDER badge (PROFILE.steamBought)
if (window.steamBridge && steamBridge.info) steamBridge.info().then((i) => {
  if (!i || !i.ready) return;
  PROFILE.steamBought(i.bought);
  if (PROFILE.steamName(i.name)) player.name = PROFILE.name();
}).catch(() => {});
// the match's role for this screen (js/net/net.js): ?net=host&room=R hosts a
// room on the dev server's relay, ?net=client&room=R joins it; nothing else
// (and any file:// page) is solo. A lobby hands the role in instead, later.
// Under the wrapper (desktop/, which exposes window.steamBridge) the same
// two roles ride a Steam lobby instead: ?net=host makes one, ?net=client&lobby=ID
// joins it (js/net/transport-steam.js).
(function () {
  const q = /[?&]net=(host|client)/.exec(location.search), r = /[?&](?:room|lobby)=([A-Za-z0-9_-]+)/.exec(location.search);
  netRelay(); // a ?relay= in the URL is remembered now, whether or not a role follows
  if (q) netSetup(q[1], netTransportFor(r ? r[1] : null)); else netSetup('solo');
})();
// ...and a page reloaded onto a party's seed to join it (joinRoom, js/ui/rooms.js),
// a Steam invite, or a rematch walks straight into the party lobby with that join under way
const JOIN_AT_BOOT = (function () { const j = /[?&]join=([A-Z0-9]+)/i.exec(location.search); return j ? j[1].toUpperCase() : null; })();
// the replay proof (js/sim/save.js): the valley as it grew is the baseline every
// save is written against, and a load that reloaded onto its seed puts the
// match back now - after the world stands, before the bake paints it
saveBaseline();
const LOADED_AT_BOOT = !NET.isClient && saveBootLoad();
prepGround(); // the ground bakes lazily from here, view first (js/draw/ground.js)
mapAlloc(); // the map slab's buffers and bake, at the size relayout() gave it
buildSettingsPanel();
camX = player.x - WV_W / 2;
camY = player.y - WV_H / 2;
if (JOIN_AT_BOOT) partyBootJoin(JOIN_AT_BOOT); // the party screen, the join under way (js/ui/rooms.js)
rematchBootHost(); // a leader back from a match: the party again, same people (js/ui/rooms.js)
// the game's first launch goes straight into the FIRST MATCH's pick (js/ui/guide.js), and its end
// lands on the hub (titleUrl, js/ui/rooms.js). A boot that came for something else keeps the hub:
// a join, a party back from a match, or a tool's ?seed=N or ?local=N
if (PROFILE.firstRun() && !LOADED_AT_BOOT && !JOIN_AT_BOOT && state.mode === 'title' && state.menu.screen === 'menu' &&
  !/[?&](seed|net|back|join|local)=/.test(location.search)) { beginParty('guide'); partyFind(); }
// landing from a reload that whited out (a rematch): the white clears to the new world
try {
  if (sessionStorage.getItem('softfall.reroll')) {
    sessionStorage.removeItem('softfall.reroll');
    state.fade = { a: 1, to: 0, spd: 1 / 0.8, color: '#f4f7ff', then: null };
  }
} catch (e) { }

// ...and a record put back at boot (saveBootLoad above, the replay proof) comes up out of
// the dark, whatever the page was about to show
if (LOADED_AT_BOOT) saveBootEnter();

// debug/dev harness: lets external tooling step frames & stage scenes
window.DBG = {
  // the bot dev view (js/ui/botview.js): what a bot thinks, the recorder, the page
  botThought, botGuess, BOTLOG, botLogExport, openBotLab, botViewStep,
  get botView() { return botView; }, set botView(v) { botView = v | 0; },
  SEED, state, animals, objects, ground, mouse, keys, footprints, flakes,
  // the ice breaking in its own shape (js/sim/icebreak.js): DBG.iceBreak(x, y, 'breach', 0, { warn: 0.9 })
  iceBreaks, iceBreak, iceBreakAge, iceBreakHolds, iceBreakWet, ICE_BREAK_SHAPES,
  // the orca and its lake (js/sim/orca.js, js/sim/world.js): its state, the line over a head, the disc
  orca, orcaLine, orcaAge, orcaShore, orcaLakeAt, orcaLakeEdge, ORCA_LINE,
  // the camps: the live registry, the table behind it, where each site is,
  // what is where, restock by hand, and give a player a bear buff by hand (campBuff(p, t, 'alpha'))
  camps, CAMPS, CAMP_SITES, campSites, campAt, stockCamps, campBuff,
  // the field (js/sim/field.js): a lane's centreline, a march down one, the
  // distance to the nearest lane (as laid), and the four mirrored copies of a spot
  laneLine, laneWaypoints, laneOut, laneDist, fieldFour,
  // the soldier waves: their records, and s to the next one (js/sim/robots.js)
  waves, waveBeat,
  // the snow's depth (js/sim/depth.js): the map, the deep band, the drifts and the wind that laid them
  snowDepth, deepAt, drifts, driftWind,
  // drop a player (default the local one) on a tile - how to stage a camp
  warp: (tx, ty, p) => { const q = p || player; q.x = (tx + 0.5) * TILE; q.y = (ty + 0.5) * TILE; q.vx = q.vy = 0; return q; },
  settings, perf, cursorInfo,
  // the local profile: the store itself, the profile screen (js/ui/profile.js)
  // and the hero row (js/ui/heroes.js), so a driver can rename, pick and read back
  PROFILE, beginProfile, leaveProfile, profileCommit, profileKey, profileHit, profileLayout,
  profileScrollBy, pfListLayout, pfSeatRects, historyNote, historyList, peopleNote, cardMine,
  applyProfile, heroList, lobbyPick, beginSkins, skinsLayout, setCoins: (n) => PROFILE.setCoins(n),
  // the radial wheel: open one by hand (state.wheel) and read back the
  // geometry the hover test and the pixels both use
  wheelLayout, wheelSpan, wheelAng, WHEEL_HUB, WHEEL_R, WHEEL_RING,
  structures, robots, arrows, STRUCTS,
  // pings: make one without a mouse (any player, through its order, as the
  // wheel does), open the wheel by hand, and read back the table
  PING_CALLS, PING_WHEEL, PING_R, mapTileAt, mapCloseHit, openPingWheel, pingWheelShown,
  // the two coordinate bridges, so a driver can put the pointer on a tile
  wToSX, wToSY, mouseWX, mouseWY,
  ping: (k, x, y, p) => runCmd(p || player, { kind: 'ping', k, x, y }),
  // the hud strip - portrait, abilities, items, bars and purse, bottom-centre;
  // `itemCellRect(i)` is item slot i's well, and `stripHit` names any well.
  hudStripRect, stripHit, itemCellRect, abCellRect, portraitRect,
  // the hero's basic attack (CLASSES[c].attack, js/sim/attack.js): its row,
  // one attack's length, a blow landed on a mark by hand, its damage, the
  // range test, and the mark a press at a world point would pick
  attackOf: (p) => attackOf(p || player), attackCycle: (p) => attackCycle(p || player),
  basicAttack: (t, p) => basicAttack(p || player, t), attackDmg: (p) => attackDmg(p || player),
  atkWind: (p) => atkWind(p || player), atkIn: (t, p) => atkIn(p || player, t), atkGood: (t, p) => atkGood(p || player, t),
  atkPick: (wx, wy, p) => atkPick(p || player, wx, wy), atkPress, drawTime,
  // a drop on the snow, so a driver can stage a pickup
  // death keeps everything (die): the one number a kill is worth
  get KILL_BOUNTY() { return killBounty(); },
  // the wind-up: 0..1 off a player's chargeT
  drawPow,
  cellPlate, chopTree,
  // the heroes' abilities: the table and a keypress by hand
  CLASS_AB,
  tryAbility: (i, p) => tryAbility(p || player, i),
  setAbilityCd: (i, t, p) => { (p || player).abCd[i] = t; },
  // ability ranks: a buy ladder on the four keys (js/sim/abilities.js)
  AB_RANK_LV, AB_ULT_LV, abLvMax: (i, p) => abLvMax(p || player, i), abLvCanBuy: (i, p) => abLvCanBuy(p || player, i),
  abRk: (id, key, p) => abRk(p || player, id, key),
  abCdOf: (i, p) => abCdOf(p || player, i),
  // level 0 is LOCKED: nothing casts off a key no point has been spent on
  abUnlocked: (i, p) => abUnlocked(p || player, i), abReady: (i, p) => abReady(p || player, i),
  buyAbilityLv: (i, p) => buyAbilityLv(p || player, i), abBuyRect, abBuyHit,
  // the wiki: its pages, the live layout (tabs, rows, window, rail), what is
  // under a point, the open page's scroll, and the way in and out; the
  // title's three tabs over it and the notes screen (js/ui/notes.js)
  WIKI_PAGES, wikiLayout, wikiHit, wikiScrollBy, wikiSetTab, beginWiki, leaveWiki,
  beginNotes, openPageTab, pageTabsLayout, notesLayout,
  // The merchant's counter (js/ui/shop.js) and the items it sells
  // (js/sim/items.js): the catalogue, the panel's geometry, and every trade
  // without the pointer
  BUILD_ITEMS, ITEM_DONE, ITEM_ALL, itemTier, itemInto, shopRecommended, itemCost: (id, p) => itemCost(p || player, id),
  buyItem: (id, p) => buyItem(p || player, id), sellItem: (slot, p) => sellItem(p || player, slot),
  botNextItem, botItemBuy,
  // the heals: the potion's slot and its drink
  potionSlot: (p) => potionSlot(p || player), useItem: (slot, p) => useItem(p || player, slot),
  POTION_HEAL, POTION_T,
  // the news plates under the minimap: the live stack, where a slot lands,
  // and a way to raise one
  notices, noteRect, NOTE_KIND, raiseNotice,
  merchNear: (p) => merchNear(p || player),
  openShop: (p) => openShop(merchNear(p || player)), closeShop, shopOpen,
  shopLayout, shopHit: (x, y) => shopHit(x == null ? mouse.x : x, y == null ? mouse.y : y),
  // what the pointer is on, as the panel would describe it (null = nothing)
  tipAt: (x, y) => tipAt(x == null ? mouse.x : x, y == null ? mouse.y : y),
  // and where this frame's panel is sitting, the rect drawTooltip paints -
  // which is how the TOOLTIP row's two modes are read without eyeballing px
  tipRect: () => { if (!tipNow) return null; const s = tipSize(tipNow); return Object.assign(tipPos(s.w, s.h), s); },
  setNock: (t, p) => { (p || player).nockT = t; }, // a huge t parks a player's bow for a capture
  // the players: all six, the local one, and the teams table
  players, MAX_PLAYERS, TEAMS, Player, contestRank,
  // the match's start: the birds' records, or start a match from scratch
  get drop() { return state.drop; }, beginMatch, makeEagles,
  // the two objectives: read them, chip one, or fell one outright without a siege
  get eagles() { return state.drop && state.drop.eagles; },
  // Perch's painter, every bird skin (js/sprites/perch.js); wear one with PROFILE.wear('bird', id)
  perch: SPRITES.perch,
  // the paint: which preset a team wears on this screen (settings.teamBlue), and the two merchants
  skin, get merchants() { return robots.filter((b) => b.merchant); },
  // the bases (js/sim/field.js): whose disc a tile is in, its perch, its radius
  baseAt, basePerch, BASE_R, waterAt,
  hurtEagle: (team, dmg, src) => { const e = state.drop.eagles[team]; hurtEagle(e, dmg == null ? 25 : dmg, src); return e; },
  eagleFlee: (team, src) => eagleFlee(state.drop.eagles[team], src),
  teamEagleDown,
  get player() { return player; },
  // goldCellRect is the always-on gold readout on the hud strip
  goldCellRect, shortNum, hudPress,
  // hand a player to an AI, a human, or nobody (a ghost at its camp)
  setControl: (id, mode) => { const p = players[id]; if (p) p.control = mode; return p; },
  // reseat this screen's player in slot `id` (a fresh roster: bots and items
  // reset), the camera on it - the same thing ?local=N does at load
  setLocal: (id) => { initPlayers(undefined, id); camX = player.x - WV_W / 2; camY = player.y - WV_H / 2; return player; },
  localId: () => localId,
  // the snapshot and its echo harness (js/net/snapshot.js): netEcho() renders,
  // snapshots, blanks, applies and renders again - a nonzero diff is a field
  // the schema is missing; netEchoRun(ticks, every) does it along a run
  netEcho, netEchoRun, snapBuild, snapApply, snapSize, NET, netSetup,
  // the two-tab match: role, peers, bytes each way, the newest snapshot tick
  netStatus: () => ({ role: NET.role, peers: [...NET.peers.values()].map((q) => q.slot), parked: NET.parked.size, synced: NET.synced, lastTick: NET.lastTick, bytesIn: NET.bytesIn, bytesOut: NET.bytesOut, bpsIn: NET.bpsIn, bpsOut: NET.bpsOut, hostOver: NET.hostOver, refused: NET.refused || null, open: !!(NET.transport && NET.transport.open), lobby: NET.transport && NET.transport.lobbyId || null, room: NET.transport && NET.transport.room || null, transportError: NET.transport && NET.transport.error || null, verify: NET.verify, verifyFail: NET.verifyFail, acks: [...NET.peers.values()].map((q) => q.ack), hist: snapShadow.hist.length, lossOut: NET.lossOut, dropped: NET.dropped, fulls: NET.fulls, framesLost: NET.transport && NET.transport.lost || 0, tileLate: snapShadow.late, tileLateBy: snapShadow.lateBy, tileHot: snapHot.size }),
  // the wire form's own proofs: netDeltaRun(ticks, every) sends `ticks` of this
  // page's sim as binary deltas and applies them back, comparing against the
  // full form after each; netVerify(on) makes a host ride its full form along
  // every VERIFY_EVERY ticks so each client checks itself (netStatus().verifyFail)
  netDeltaRun, netVerify: (on) => { NET.verify = !!on; return NET.verify; }, netLoss: (f) => { NET.lossOut = +f || 0; return NET.lossOut; }, snapHistoryPush, snapDeltaFrom, snapBuildDelta, snapEncode, snapDecode, encDict,
  // the wrapper's lobbies, for a joiner picking one by hand (steamBridge only)
  lobbies: () => (window.steamBridge ? window.steamBridge.lobbies() : Promise.resolve([])),
  placeObj, idx, objAt, damagePlayer, die, endMatch, specNext, updateAI, contest,
  // the post-game lobby (js/ui/lobby.js): freeze the table by hand, open the
  // screen without walking a ceremony, drive it, and read back both the
  // frozen record and the live screen state
  statFreeze, sampleStats, openScores, scoresLayout, scoresHit, scoresKey, scoresClick, scores,
  get matchStats() { return matchStats; },
  // the two end screens: their timelines, the frozen numbers they print, and
  // a way to open the loss summary without pressing its plank. Set
  // state.defeatT / state.deadTimer to scrub either ceremony to a beat.
  WIN_T, DEF_T, openDefeat, endSnapshot, endScreen, deadLayout, deadHit, deadActivate, respawnTime,
  // the replay window's rect this frame, its close box, and whether the pointer is on it
  rpRect, rpCloseRect, rpCloseHit,
  // routes: the search itself, and showPaths = true draws every unit's live route
  findPath, walkable, navTo, showPaths: false,
  // hero levels: pay a player gold, or XP, the way the match would
  gainGold: (n, p) => gainGold(p || player, n), gainXp: (n, p) => gainXp(p || player, n), LEVEL_XP, LEVEL_MAX,
  // the stat ledger, the sheet that flies into the notice lane when a number
  // moves (the `stat ledger` block, js/ui/shop.js): the table every surface
  // prices a body with, the plate's own size, the live values, what each row
  // is still lit for, and the raise without a change behind it - so a driver
  // can prove a level or an item moved the number it was meant to
  STAT_ROWS, STAT_W, statPlateH, raiseStatNote, noteLaneFloor,
  statValues: (p) => STAT_ROWS.map(([n, get, fmt]) => [n, fmt(get(kitOf(p || player), p || player))]),
  statLit: () => STAT_ROWS.map(([n], i) => (statLit[i] ? [n, statDeltaTxt(statLit[i].d, STAT_ROWS[i][2]), statLit[i].t] : null)).filter(Boolean),
  // a player's effective kit, the G panel's geometry, and the hero pop-up
  kitOf, refreshKit, charItemHit, charLayout, charHit,
  heroLayout, heroScreenHit, beginHero,
  // the match readouts: the log (not drawn - read it here), staged lines
  // without the kills behind them, and the standings (hold TAB in game, or
  // set keys.tab here)
  events, logEvent, scoreGroups, scoreboardOpen,
  // the four-second replay: the filmstrip itself, how much is banked, whether it is up, and whether it fills the frame
  replay: {
    get cv() { return rpAt; }, get frames() { return rpCount; }, showing: replayShowing, full: replayFull,
    get shot() { return [rpFW[(rpHead - 1 + RP_N) % RP_N], rpFH[(rpHead - 1 + RP_N) % RP_N]]; },
    get slot() { return [rpSW, rpSH]; }, get bytes() { return rpAt ? rpAt.width * rpAt.height * 4 : 0; },
    W: RP_W, H: RP_H, fps: RP_FPS, rate: RP_RATE, ov: rpOv,
  },
  // action entry points default to the local player, or take any player
  tryWork: (p) => tryWork(p || player),
  workTarget: (p) => workTarget(p || player),
  tryDodge: (p) => tryDodge(p || player),
  // status effects (js/sim/actions.js): the one blow every kind of unit takes,
  // every state one can be put under, and the two lists an area effect
  // sweeps. `e` defaults to the local player wherever it is the last argument.
  hurtUnit, unitsNear, unitsHit, unitMoveMul, unitFoe, unitAlive, sideOf, clearUnitStatus,
  rootUnit: (t, e) => rootUnit(e || player, t),
  slowUnit: (t, mul, e) => slowUnit(e || player, t, mul),
  markUnit: (t, e) => markUnit(e || player, t),
  // fire: light a body, put it out, and the numbers a burn runs on
  igniteUnit: (t, dps, e, src) => igniteUnit(e || player, t, dps, src === undefined ? player : src),
  douseUnit: (e) => douseUnit(e || player),
  DMG_TYPES, BURN_DPS, BURN_TICK, BURN_MAX,
  // the roll as a hit: stun anything by hand, and read back what a roll at a
  // given speed would deal (`.` draws the sweep circle over a live dash)
  stunUnit: (t, e) => stunUnit(e || player, t),
  rollDmg: (sp, p) => rollDmg(p || player, sp),
  rollSweep: (p) => rollSweep(p || player),
  ROLL_HIT_R, ROLL_FAST, ROLL_DMG, ROLL_STUN, TACKLE_STUN, TACKLE_SELF, TACKLE_MIN,
  // how far a player is noticed from by a watcher with this plain range
  seenAt: (range, p) => seenAt(p || player, range),
  // the fog of war (js/sim/fog.js): fog = false lifts it for a debug look;
  // inSight(team, u) is what that side sees, fogShown(u) what this screen draws
  fog: true, inSight, fogShown: (u) => fogShown(u),
  spawnAnimal: (kind, x, y) => { const a = makeAnimal(kind, x, y); animals.push(a); return a; },
  // the level a spawn is dealt (the table's average)
  animalLevel,
  // debug staging: place a construction site directly, no cost or validation
  buildStruct: (tx, ty, type) => createStruct(tx, ty, type, player, true), // anchor = top-left for a big footprint
  structOf, footprint,
  finishBuild: (o) => { if (o && o.building) o.buildT = o.buildTotal; },
  // z is a world scale; it lands on the nearest pixel-exact rung, as the
  // wheel does. snap skips the ease. setK sets the rung itself.
  setZoom: (z, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), Math.round((+z || 1) * worldDev))); if (snap) applyZoom(0, true); }, // z at the default UI SIZE
  setK: (k, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), k | 0)); if (snap) applyZoom(0, true); },
  getZoom: () => ({ want: zoomWantOf(), applied: zoomCur, k: kWant, devScale, worldDev, exact: Math.abs(zoomCur * devScale - Math.round(zoomCur * devScale)) < 1e-6,
    rungs: (() => { const r = []; for (let k = kMin(); k <= kMax(); k++) r.push(+(k / devScale).toFixed(4)); return r; })(),
    wv: [WV_W, WV_H] }),
  cam: () => ({ x: camX, y: camY }),
  // the day's weather: weather('blizzard') pins one (fading to it like a dawn
  // would; weather() lets the day decide again), wx the dials in force now,
  // weatherOf(day) what a day rolls on this seed
  weather: (name) => { state.wxForce = name && WEATHERS[name] ? name : null; },
  get wx() { return weatherNow(); }, weatherOf,
  startGame, beginIntro, beginLobby, lockIn, pressPlay, setAiLevel, DRAFT, draftAct, draftPoint, draftConfirm, lobbyLayout, AI_LEVELS, AI_ALLIES, aiProfile, setClass, CLASSES, menu: state.menu, hubLayout, roomHit, menuClick, menuKey, lobbyHit,
  // the ESC panel: what the pointer is over, the speaker's plate, the open
  // page's row anchors (already scrolled - a row's y is where it is on
  // screen) and the navbar cells - so a driver can click a dial without
  // guessing at the pitch. setSettingsTab flips the page directly.
  settingsHit, muteBtnRect, settingsScrollBy,
  setSettingsTab: (id) => { setTab = id; },
  get settingsTab() { return setTab; }, // the open page (a let, so a getter)
  // the key binds: the action table, the live map, the rebind by hand
  // (setBind swaps exactly as a listening cap would), and keyName - which
  // reads a KeyboardEvent, or a bare {code, key}, the way the listener does,
  // so an AZERTY board can be staged without one. keyRows is where every
  // cap on the CONTROLS page sits, listing-local.
  KEY_ACTIONS, setBind, resetBinds, rebindStart, keyName, keyLabel, keyCap, mendBinds,
  get binds() { return binds(); }, // the live scheme's map
  // the CLICK scheme (input.js): its state, the two presses and the pickers
  ck, ckOn, ckClear, ckRightPress, ckRightRelease, ckArmedPress,
  pointerPress, pointerRelease,
  ckAcquire: (p) => ckAcquire(p || player), ckSees: (t, p) => ckSees(p || player, t), unitUnder, mmWorldAt,
  // the key entry points a driver presses through
  keyPress, keyRelease, settingsLayout,
  keyRows: () => keyRowsLayout(),
  get settingsRows() {
    const L = settingsLayout();
    const rows = {};
    for (const r of L.rows) rows[r.id] = r.y - L.scroll;
    return { tab: setTab, tabs: L.tabs, rows, scroll: L.scroll, maxScroll: L.maxScroll,
      x: SL_X, w: SL_W, panel: { x: SET_X, y: SET_Y, w: SET_W, h: SET_H } };
  },
  layout: () => ({ VIEW_W, VIEW_H, SET_X, SET_Y, SL_X, PANEL_X, PANEL_Y, MM_X, MM_Y, MM_W }),
  hideUI: false,
  showMarks: false, // ...but the basic attack's rings on the snow stay (drawClickMarks), for a staged still
  // director mode (js/app/director.js): its state, and its keys as pressed
  director, directorKey: (key) => keyPress({ key, repeat: false, char: key }),
  // the replay proof (js/sim/save.js): the record, its hash, and the record put back on a fresh page
  saveCapture, saveApply, saveHash, saveLoad: saveDevLoad,
  step: (dt, n) => { for (let i = 0; i < (n || 1); i++) { update(dt || TICK_DT); } render(); },
};

// ------------------------------------------------------------ the fixed step
// The sim steps in TICK_DT slices, never in the frame's own delta. A frame
// banks its time in `tickAcc` and update() runs once per whole slice owed,
// so a 60 Hz screen steps about once a frame, a 144 Hz screen about every
// other frame, and a stall steps several times in one - and the world's
// clocks, the momentum walk and every cooldown read the same dt on every
// machine whatever the refresh rate. That is what lets a step be numbered
// (state.tick), stamped onto an input and replayed by a host: the
// precondition for online play (docs/pvp-architecture.md). 1/60 because
// that is the step the game was tuned under - the attack cycles were
// counted in it, and the integrators have only ever seen 16 ms - so the feel
// is the one it had; a coarser network tick is a snapshot cadence, not a
// sim one. render() still runs once per frame, and draws the world part of
// the way between the last two steps (the in-between frames, below).
const TICK_DT = 1 / 60;
// steps one frame may take: three is the old 50 ms dt cap, one slice at a
// time. Past it the rest of the owed time is DROPPED, not banked, so a long
// stall costs a moment of slow motion and never a spiral of catch-up steps
const TICK_MAX = 3;
// a step is owed once the bank is within TICK_SLACK of a whole slice. rAF's
// stamps jitter a ms or two around the refresh, and a bank that had to
// reach the slice exactly would take 0 steps one frame and 2 the next on a
// 60 Hz screen - a visible stutter. Stepping this little early lets the
// bank run slightly negative and settle back, so the AVERAGE rate stays
// exactly 60 and almost every 60 Hz frame takes exactly one step
const TICK_SLACK = TICK_DT * 0.25;
let tickAcc = 0;

// THE IN-BETWEEN FRAMES. A screen faster than 60 Hz draws two or three
// frames per step, and without this every one of them repeated the last
// step's camera and bodies: on a 144 Hz screen a zipline ride scrolled 0, 0,
// 25, 0, 22 device px a frame, the whole screen lurching in bursts. Before
// each step tweenMark notes where the camera (its centre and zoom) and
// every mover stands; render then draws them part of the way from there to
// where the step put them, by how far the clock has got toward the next
// step (tickAcc), and tweenOut puts the sim's own values back before
// anything else reads them. Render-only: no step ever sees an in-between
// value. The movers are the bodies the eye follows - players, wildlife,
// robots, the birds, shots and flying loot; particles and floaters are
// cosmetic and draw each step as it is. A jump bigger than TWEEN_SNAP (the
// intro's cut, a landing, a respawn) is drawn where it lands, never smeared
// across it, and a camera that cut takes its zoom with it.
const TWEEN_SNAP = 48; // px a mover may cover in one step and still be drawn in between
const tween = { on: false, cx: 0, cy: 0, z: 1, was: [], now: [] };
function tweenMark() {
  tween.on = state.mode !== 'title';
  if (!tween.on) return;
  tween.cx = camX + WV_W / 2; tween.cy = camY + WV_H / 2; tween.z = zoomCur;
  const w = tween.was;
  w.length = 0;
  if (state.drop) for (const e of state.drop.eagles) w.push(e, e.x, e.y);
  for (const p of players) if (p.active) w.push(p, p.x, p.y);
  for (const a of animals) w.push(a, a.x, a.y);
  for (const r of robots) w.push(r, r.x, r.y);
  for (const a of arrows) w.push(a, a.x, a.y);
}
function tweenIn() {
  tween.now.length = 0;
  if (!tween.on || state.mode === 'title') return;
  // shown a quarter step behind the clock, so a 60 Hz screen, whose frames
  // land about on the steps (TICK_SLACK), always draws at about 0.25
  const a = Math.max(0, Math.min(1, (tickAcc + TICK_SLACK) / TICK_DT));
  const mix = (o, n) => Math.abs(n - o) > TWEEN_SNAP ? n : o + (n - o) * a;
  // the camera by its CENTRE, since applyZoom holds the centre still
  // through a zoom: easing the corner with the zoom stepped would swing the
  // picture about it between steps
  const cx = camX + WV_W / 2, cy = camY + WV_H / 2;
  const cut = Math.abs(cx - tween.cx) > TWEEN_SNAP || Math.abs(cy - tween.cy) > TWEEN_SNAP;
  tween.now.push(null, camX, camY, zoomCur, WV_W, WV_H);
  if (!cut) {
    zoomCur = tween.z + (zoomCur - tween.z) * a;
    sizeWorldView();
    camX = tween.cx + (cx - tween.cx) * a - WV_W / 2;
    camY = tween.cy + (cy - tween.cy) * a - WV_H / 2;
  }
  const w = tween.was;
  for (let i = 0; i < w.length; i += 3) {
    const b = w[i];
    tween.now.push(b, b.x, b.y);
    b.x = mix(w[i + 1], b.x); b.y = mix(w[i + 2], b.y);
  }
}
function tweenOut() {
  const n = tween.now;
  if (n.length) {
    camX = n[1]; camY = n[2]; zoomCur = n[3]; WV_W = n[4]; WV_H = n[5];
    for (let i = 6; i < n.length; i += 3) { n[i].x = n[i + 1]; n[i].y = n[i + 2]; }
  }
  n.length = 0;
}

// A HIDDEN TAB does not get animation frames, and its timers are held to a
// beat a second - which is fine for one screen and the end of the match for
// nine others when that screen is the host (docs/pvp-architecture.md, risk
// 3). A worker's clock is not throttled the same way, so while the page is
// hidden the frames come from one, and the visible page goes back to rAF.
let hiddenTimer = null;
function hiddenTick() { if (document.hidden) loop(performance.now()); }
function watchHidden() {
  if (document.hidden && !hiddenTimer) {
    try {
      const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
      w.onmessage = hiddenTick; hiddenTimer = w;
    } catch (e) { hiddenTimer = setInterval(hiddenTick, 16); }
  } else if (!document.hidden && hiddenTimer) {
    if (hiddenTimer.terminate) hiddenTimer.terminate(); else clearInterval(hiddenTimer);
    hiddenTimer = null;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}
document.addEventListener('visibilitychange', watchHidden);
watchHidden(); // a page opened in a background tab never gets a first frame to arm itself from

// THE FPS CAP. settings.fpsCap (the VIDEO page's FPS CAP row; 0 = every
// frame the screen offers) skips whole frames: a skipped one leaves `last`
// alone, so its time is banked into the next and the sim still takes every
// 1/60 s step it is owed - the cap is on the presentation, never the step.
// `capDue` is when the next frame may run, advanced by one period per frame
// taken so the AVERAGE rate is exactly the cap on any refresh rate (30 on a
// 60 Hz screen is every other frame, not a beat that drifts against it),
// with a quarter period of slack because rAF's stamps jitter; a due clock
// more than a period behind (a stall, a hidden tab) resyncs instead of
// paying itself back as a burst.
let capDue = 0;
function capSkips(nowMs) {
  const cap = settings.fpsCap;
  if (!cap) return false;
  const per = 1000 / cap;
  if (nowMs < capDue - per * 0.25) return true;
  capDue = nowMs - capDue > per ? nowMs + per : capDue + per;
  return false;
}

let last = performance.now();
let bootMark = document.getElementById('bootmark'); // the logo index.html has shown since the page's first paint
function loop(nowMs) {
  // the next frame is asked for first: a throw in a step or a draw is still
  // reported, but costs that one frame, never the whole game (a client's
  // frozen end screen, QA2-004)
  try { loop1(nowMs); } finally {
    if (!document.hidden) requestAnimationFrame(loop); // hidden: the worker calls loop() instead
    else watchHidden();
  }
}
function loop1(nowMs) {
  if (capSkips(nowMs)) return;
  const rawDt = (nowMs - last) / 1000;
  // clamped at BOTH ends: rAF can hand back a stamp behind the clock `last`
  // was taken off (a headless first frame, a tab restored from the bfcache),
  // and a negative dt would run the bank backwards. Capped above for the
  // opposite reason: a long stall (a hidden tab, a debugger) must not owe
  // seconds of steps
  const dt = Math.max(0, Math.min(TICK_DT * TICK_MAX, rawDt));
  last = nowMs;
  perfFrame(rawDt);
  if (!window.DBG.freeze) {
    tickAcc += dt;
    let n = 0;
    const t0 = performance.now();
    while (tickAcc >= TICK_DT - TICK_SLACK && n < TICK_MAX) {
      tweenMark();
      update(TICK_DT);
      tickAcc -= TICK_DT;
      n++;
    }
    if (n === TICK_MAX && tickAcc > 0) tickAcc = 0; // the stall's remainder is dropped, not owed
    const t1 = performance.now();
    // a hidden page draws nothing: nobody can see it, and a minimised Steam
    // window would otherwise keep the GPU drawing 60 frames a second. Its sim
    // keeps stepping above (the host's match goes on). A take being recorded
    // keeps its frames. The replay ring banks no frames meanwhile.
    if (!document.hidden || director.rec) {
      tweenIn();
      try { render(); } finally { tweenOut(); } // the sim's values back, whatever render does
    }
    perf.simAcc += t1 - t0; perf.drawAcc += performance.now() - t1;
  }
  if (bootMark) { bootMark.remove(); bootMark = null; } // the first frame is drawn (or a frozen or hidden page has skipped it): the page's logo comes down behind it
}
pageListenStart(); // keys, mouse and resize reach the game only now that every global stands (js/sim/core.js)
requestAnimationFrame(loop);
