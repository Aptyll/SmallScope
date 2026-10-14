// Softfall - a cozy winter survival game.
'use strict';
// The last file to load: the boot order, window.DBG and the
// requestAnimationFrame loop. The eagle drop it starts is js/eagle.js.

// ------------------------------------------------------------ boot
function startGame() {
  SFX.unlock();
  beginDrop();
}

PROFILE.load();   // the profile carries the settings, so it is read first
loadSettings();
mendBinds(); // the profile's key binds made whole (input.js)
// ...and the tech tree, which decides what this profile's world may drop.
// Must run after PROFILE.load() and before initPlayers()/any swing.
rebuildLootPool();
// ...and the merchants' market, which primes three days of prices behind it
// so the counter's graphs are graphs on day one (js/shop.js).
initMarket();
fitCanvas(); relayout(); // the window may have changed size while the scripts loaded (no resize listener yet); this places the UI for the fitted view
SFX.setVolume(settings.volume);
SFX.setMusicVolume(settings.musicVol);
SFX.setSfxVolume(settings.sfxVol);
SFX.setMuted(settings.muted);
// the title track. Browsers refuse audio before a gesture, so SFX.music holds
// this as pending and the first click or keypress starts it (see js/audio.js).
SFX.music.play('intro', { in: 1.5 });
if (PRACTICE) {
  // the training field (the `practice arena` banner, js/practice.js): a fixed
  // room instead of a match world - one dummy, open targets, the ice parkour,
  // and nothing that spawns or restocks: no camps, chests, wildlife or
  // eagles at all
  genPracticeWorld();
} else {
  // the SHAPE this page grew (MAPS, js/world.js): ?map=N wins, else the
  // profile's pick, so a reload carries a pick the way ?seed carries a
  // reroll. Read after loadSettings and before genWorld, and never again.
  MAP_TYPE = (function () {
    const q = /[?&]map=(\d+)/.exec(location.search);
    const k = q ? +q[1] : settings.mapType | 0;
    return k >= 0 && k < MAPS.length ? k : 0;
  })();
  settings.mapType = MAP_TYPE; // the lobby's pick starts as the shape standing (a ?map=N page may differ from the profile's)
  genWorld();
  placeCreek();     // the creek down the cross-diagonal, its bends and fords, and the cistern round its frozen middle (world.js, cistern.js)
  layPaths();       // ...and the paths a grown shape cuts through its own woods, forded where they cross it (world.js)
  placeRoad();       // the diagonal lane, and the paths with it (world.js)
  placeZips();       // ...and each side's cable along it (js/zipline.js)
  placeCamps();      // worldgen's last pass, before the ground is baked: the camps clear their sites
  placeChests();     // ...then the caches take their trees (objects only, no ground)
  placeRocks();      // ...and the rocks move out to their clusters on the rim, on their own stream (world.js)
  placeLandmarks();  // ...and the story landmarks take their spots, on a stream of their own (landmarks.js)
  spawnAnimals();
  spawnFish();
  spawnOrca();       // ...and the orca under its lake (js/orca.js)
  stockCamps();      // the monsters go in once the world is standing
}
layDrifts();         // the snow's depth, in the lee of everything worldgen stood up (js/depth.js)
initPlayers();
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
// ...and a page reloaded onto a room's seed to join it (joinRoom, js/ui/menu.js)
// walks straight into the rooms screen with that join under way
const JOIN_AT_BOOT = (function () { const j = /[?&]join=([A-Z0-9]+)/i.exec(location.search); return j ? j[1].toUpperCase() : null; })();
// a saved match (js/save.js): the valley as it grew is the baseline every
// save is written against, and a load that reloaded onto its seed puts the
// match back now - after the world stands, before the bake paints it
if (!PRACTICE) saveBaseline();
const LOADED_AT_BOOT = !PRACTICE && !NET.isClient && saveBootLoad();
prepGround(); // the ground bakes lazily from here, view first (js/draw/ground.js)
mapAlloc(); // the map slab's buffers and bake, at the size relayout() gave it
buildSettingsPanel();
buildHelpPanel();
camX = player.x - WV_W / 2;
camY = player.y - WV_H / 2;
// practice boots straight onto the snow: no title, no eagle. The other nine
// players empty out (control 'none' - `active` is derived from it) and stand
// parked in the corner forest, far outside the arena, so their ghost
// silhouettes never wander into a capture; the local player takes the arena's
// spawn tile and the HUD slides in the way a landing's does.
if (PRACTICE) {
  for (const p of players) {
    if (p === player) continue;
    p.control = 'none';
    p.spawn = { tx: 4, ty: 4 };
    p.x = (4.5) * TILE; p.y = (4.5) * TILE;
  }
  player.spawn = { tx: PR_SPAWN.tx, ty: PR_SPAWN.ty };
  player.x = (PR_SPAWN.tx + 0.5) * TILE;
  player.y = (PR_SPAWN.ty + 0.5) * TILE;
  // early morning, forever: sim.js never advances state.time under PRACTICE,
  // so this is the arena's one fixed hour - crisp daylight, shadowless dawn
  state.time = 0;
  state.mode = 'play';
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, player.x - WV_W / 2));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, player.y - WV_H / 2));
  state.introFrom = { x: camX, y: camY };
  state.intro = HUD_IN_T; state.introLen = HUD_IN_T;
} else if (!PROFILE.hasChar()) {
  // a fresh install: the first thing seen is the create screen, opened on a
  // pre-rolled character (js/ui/chars.js) - the title menu is behind it
  beginCreate(-1, true);
}
if (JOIN_AT_BOOT && !PRACTICE && PROFILE.hasChar()) { beginRooms(); state.menu.rsel = -2; netJoin(JOIN_AT_BOOT); }
// landing from a reroll: the whiteout the die left behind clears to the new world
try {
  if (sessionStorage.getItem('softfall.reroll')) {
    sessionStorage.removeItem('softfall.reroll');
    state.fade = { a: 1, to: 0, spd: 1 / 0.8, color: '#f4f7ff', then: null };
    state.menu.rolling = 0.5;
  }
  // ...and from a MAP PICK, which is the same page on the same seed in a new
  // shape (pickMap, js/ui/menu.js): it clears onto the screen it was made on,
  // so picking a shape is one press and not a walk back through the menu
  // (through the lobby's own night, not the white: the screen went dark on
  // itself and comes back up on itself)
  if (sessionStorage.getItem('softfall.select')) {
    sessionStorage.removeItem('softfall.select');
    if (!PRACTICE && PROFILE.hasChar() && !JOIN_AT_BOOT) {
      beginLobby(); state.menu.screenT = 1;
      if (state.fade) state.fade.color = LOBBY_NIGHT;
    }
  }
  // ...and from LOCK IN on a shape this page had not grown (lockIn, js/ui/menu.js):
  // the page came back on this seed in that shape and goes straight to the
  // eagle, the gear picks, stat points and ability picks it carried put back on (no profile holds them)
  const dropRaw = sessionStorage.getItem('softfall.drop');
  if (dropRaw) {
    sessionStorage.removeItem('softfall.drop');
    if (!PRACTICE && PROFILE.hasChar() && !JOIN_AT_BOOT) {
      try {
        const d = JSON.parse(dropRaw);
        if (d && Array.isArray(d.gear)) player.gear = d.gear.map((v) => v | 0);
        if (d && Array.isArray(d.pts)) player.pts = d.pts.map((v) => v | 0);
        if (d && Array.isArray(d.abPick)) player.abPick = d.abPick.map((v) => v | 0);
      } catch (e) { }
      setClass(player, player.cls);
      beginDrop();
    }
  }
} catch (e) { }

// ...and a saved match put back at boot (saveBootLoad above) comes up out of
// the dark, whatever the page was about to show
if (LOADED_AT_BOOT) saveBootEnter();

// debug/dev harness: lets external tooling step frames & stage scenes
window.DBG = {
  // the bot dev view (js/ui/botview.js): what a bot thinks, the recorder, the page
  botThought, botGuess, BOTLOG, botLogExport, openBotLab, botViewStep,
  get botView() { return botView; }, set botView(v) { botView = v | 0; },
  SEED, state, animals, objects, ground, mouse, keys, drops, footprints, flakes,
  fish, iceCracks, holes, crackIce, addFish, spawnEmerger, netAt, buildSiteAt,
  // the ice breaking in its own shape (js/icebreak.js): DBG.iceBreak(x, y, 'breach', 0, { warn: 0.9 })
  iceBreaks, iceBreak, iceBreakAge, iceBreakCovers, iceBreakHolds, iceBreakWet, ICE_BREAK_SHAPES,
  // the orca and its lake (js/orca.js, js/world.js): its state, the line over a head, the disc
  orca, orcaLine, orcaAge, orcaShore, orcaLakeAt, orcaLakeEdge, ORCA_LINE,
  // the shoal the water this shape froze can hold (the fish banner, wildlife.js)
  get fishCap() { return fishCap; }, get fishFloor() { return fishFloor; },
  // the camps: the live registry, the table behind it, where each site is,
  // what is where, restock by hand, and give a player a bear buff by hand (campBuff(p, t, 'alpha' | 'dire'))
  camps, CAMPS, CAMP_SITES, campSites, campTile, campAt, stockCamps, campBuff, flushBirds,
  // the map shape this page grew, the table behind it, the rule one IS, and
  // the paths it cut: DBG.mapTerrain(k, tx, ty) answers for any shape
  MAPS, mapTerrain, mapName, mapGrown, paths, pathDist,
  // the snow's depth (js/depth.js): the map, the deep band, the drifts and the wind that laid them
  snowDepth, deepAt, drifts, driftWind,
  get MAP_TYPE() { return MAP_TYPE; },
  // the practice arena: whether this boot is one, the dummy's live record,
  // the spawn tile, the shared hit paths, the archery targets, the parkour
  // clock and the ESC slab's exit plank
  PRACTICE, practiceDummies, PR_SPAWN, hitDummy, leavePlankRect,
  ptargets, ptFace, ptLive, ptHitR, hitPTarget, parkour,
  // the archery round: the live state, the difficulty tables, the bell's
  // resolver, ring a round in by hand at a difficulty (warp beside AG_BELL
  // first - the reach check is real), spawn one random target, and the
  // track parametrisation for staging shots
  agame, AG_DIFF, agBellNear, agSpawn, agStock, agPos, AG_LEN, AG_BELL,
  agRing: (diff, p) => agRing(p || player, { tx: AG_BELL.tx, ty: AG_BELL.ty, id: diff || agame.mode }),
  get agStreak() { return agStreak; }, // the consecutive-hit run (rebinds, so a getter)
  // the parkour roll station: roll a track by hand, resolve the die E would
  // open the wheel on, and watch the sweep (pkAnim rebinds, so a getter;
  // pkAnimStep lets a driver fast-forward the front)
  pkRoll, pkDieNear, pkWheelPick, PK_DIFFS, pkAnimState: () => pkAnim, pkAnimStep,
  // drop a player (default the local one) on a tile - how to stage a camp
  warp: (tx, ty, p) => { const q = p || player; q.x = (tx + 0.5) * TILE; q.y = (ty + 0.5) * TILE; q.vx = q.vy = 0; return q; },
  settings, perf, treeRare, cursorInfo,
  // the other controller (js/gamepad.js): its live state
  pad, padActive,
  // the local profile: the store itself and the character screens (js/ui/chars.js),
  // so a driver can open the roster or the create screen and read back what it accepts
  PROFILE, beginChars, leaveChars, beginCreate, createCommit, createCancel, createKey, createHit, charsHit,
  createLayout, charsLayout, nameOk, charTagRect, overCharTag, applyCharacter, activateChar, beginSkins, skinsLayout, birdSkinFor, coinTagRect, setCoins: (n) => PROFILE.setCoins(n),
  // the radial wheel: open one by hand (state.wheel) and read back the
  // geometry the hover test and the pixels both use
  wheelLayout, wheelSpan, wheelAng, WHEEL_HUB, WHEEL_R, WHEEL_RING,
  structures, robots, tracers, arrows, STRUCTS, SWING_TOOLS, TOOLS, BITS,
  // the team flag: plant one without a mouse (any player), lift it, open the
  // wheel by hand, and read back whose flag a body serves and the ring
  FLAG_TYPES, FLAG_ORDER, FLAG_R, mapTileAt, mapCloseHit, servedFlag, humanFlag, inFlag, openFlagWheel,
  // the two coordinate bridges, so a driver can put the pointer on a tile
  wToSX, wToSY, mouseWX, mouseWY,
  plantFlag: (tx, ty, type, p) => plantFlag(p || player, tx, ty, type),
  clearFlag: (p) => clearFlag(p || player),
  get flag() { return player.flag; },
  // the hud strip - portrait, abilities, bars and meals, bottom-centre.
  hudStripRect, stripHit,
  // Tools and bits: the two tables, the tier palette, an instance maker, the
  // firing pipeline and the loot roll - so a driver can stage a build without
  // mining for it. `shelfCellRect(-1)` is the weapon's one well, and
  // `shelfCellRect` / `shelfHit` the always-up shelf's (cell -1 is the tool).
  // `fitAdd` is the pickup's own path: a bit into the tool, the rest in the pack.
  TOOL_TIERS, TOOL_SLOTS, makeTool, toolType, bitType, bitMods, newMods, fitAdd,
  // toolPlan is the whole press resolved without firing it: what the budget
  // reaches, through which envelope, and where it runs out (`cut`)
  toolPlan, toolLoad, toolDrawMul, drawTime, sortBits,
  toolRof, toolCycle, peekBit, toolReady, dropLoot, giveLoadout, CLASS_LOADOUT,
  // a thing put down on purpose: the throw (out of the pack, along the
  // cursor), the lock that keeps it out of the thrower's own hands, and the
  // bits a tool sheds as it lands - so a driver can stage a discard without
  // a drag. And the swap: whether a find would take the hand, doing it, and
  // the risen icons it leaves for drawSwaps.
  spawnDrop, throwCell, flingDrop, lockDrop, dropLocked, TOSS_SPEED, TOSS_LOCK_T,
  shedBits, SHED_KICK, BIT_STACK, swaps, SWAP_T,
  // death keeps everything (die): the one number a kill is worth
  KILL_BOUNTY,
  toolUpgrade: (cell, p) => toolUpgrade(p || player, cell),
  takeUpgrade: (cell, p) => takeUpgrade(p || player, cell),
  // the draw curve: 0..1 off a player's chargeT, and the flight and damage it buys a bit
  drawPow, shotFlight, drawDmgMul, DRAW_RANGE_MIN, DRAW_SPEED_MIN, DRAW_DMG_MIN,
  shelfCellRect, shelfHit, shelfRails, tierPlate,
  // the closing line's three bits: what a shot does where it LANDS, the
  // teleport with no shot to fire it, the flashes it strings across the jump,
  // and the chop a thrown axe lands - so a driver can prove an arrival or a
  // fell without waiting for one to connect
  BIT_IMPACT, warps, WARP_FLASH_T, AXE_CHOP_R, chopTree,
  warpPlayer: (x, y, p) => warpPlayer(p || player, x, y),
  // the class abilities: the table, a keypress by hand, and the entity lists
  // an ability leaves in the world - so a driver can stage a crater or a net
  // without walking a bot into one
  CLASS_AB, abCraters: craters, abNets: nets,
  tryAbility: (i, p) => tryAbility(p || player, i),
  setAbilityCd: (i, t, p) => { (p || player).abCd[i] = t; },
  // ability levels: gear's ladder on the four keys (js/abilities.js)
  AB_LV_MAX, abLvCanBuy: (i, p) => abLvCanBuy(p || player, i),
  abCdOf: (i, p) => abCdOf(p || player, i),
  // level 0 is LOCKED: nothing casts off a key no point has been spent on
  abUnlocked: (i, p) => abUnlocked(p || player, i), abReady: (i, p) => abReady(p || player, i),
  buyAbilityLv: (i, p) => buyAbilityLv(p || player, i), abBuyRect, abBuyHit,
  // the arsenal tree: the graph, the page's own geometry, and the pool a
  // match drops from - which is the whole arsenal, the same for every profile.
  // `wipeTech` forgets what this profile has HELD (the blue pips), which is
  // all a profile still remembers about the tree.
  TECH, rebuildLootPool, LOOT_POOL,
  // the wiki: its pages, the live layout (tabs, rows, window, rail), what is
  // under a point, the open page's scroll, and the way in and out; the
  // title's three tabs over it and the notes screen (js/ui/notes.js)
  WIKI_PAGES, wikiLayout, wikiHit, wikiScrollBy, wikiSetTab, beginWiki, leaveWiki,
  beginNotes, openPageTab, pageTabsLayout, notesLayout,
  wipeTech: () => PROFILE.clearTech(),
  // The merchant's counter (js/shop.js): the live market and its two goods,
  // the rolled stock, the panel's geometry, and every trade without the
  // pointer. `marketStep(n)` walks the prices n moves on so a driver can watch
  // a spike without waiting three days for one, and `shopRestock()` turns the
  // counter over on the spot - quietly, or `shopRestock(true)` with the plate
  // and the two-beat cue a real turnover raises.
  market, GOODS, MKT_STEP, MKT_HIST, MKT_DAYS, SHOP_RESTOCK, marketPrice, marketHist,
  marketStep: (n) => { for (let i = 0; i < (n || 1); i++) updateMarket(MKT_STEP); return MKT_ORDER.map(marketPrice); },
  shopRestock: (loud) => shopRestock(!loud), shopOffer, itemValue, cellValue, sellValue,
  // the market's plates under the minimap: the live stack, where a slot lands,
  // and a way to raise one without waiting for the walk to do it
  notices, noteRect, NOTE_KIND, raiseNotice,
  merchNear: (p) => merchNear(p || player),
  openShop: (p) => openShop(merchNear(p || player)), closeShop, shopOpen,
  shopLayout, shopHit: (x, y) => shopHit(x == null ? mouse.x : x, y == null ? mouse.y : y),
  shopBuy: (sec, i, p) => shopBuy(p || player, sec, i),
  shopSellCell: (i, p) => shopSellCell(p || player, i),
  // the SELL ALL button's own press, and the two numbers it reads itself out
  // with - the pack's worth over the counter and how many cells that is
  shopSellAll: (p) => shopSellAll(p || player), packValue: (p) => packValue(p || player),
  packCount: (p) => packCount(p || player),
  shopTrade: (id, dir, p) => shopTrade(p || player, id, dir),
  CARD_PRICE,
  // what the pointer is on, as the panel would describe it (null = nothing)
  tipAt: (x, y) => tipAt(x == null ? mouse.x : x, y == null ? mouse.y : y),
  // and where this frame's panel is sitting, the rect drawTooltip paints -
  // which is how the TOOLTIP row's two modes are read without eyeballing px
  tipRect: () => { if (!tipNow) return null; const s = tipSize(tipNow); return Object.assign(tipPos(s.w, s.h), s); },
  fireTool: (p) => fireTool(p || player),
  // the fish catch's three beats: start one by hand, read which frame a body is on
  startCatch: (p) => startCatch(p || player), cancelCatch: (p) => cancelCatch(p || player), catchFrame,
  get tools() { return player.tools; },
  // stage a loaded tool straight onto a slot: DBG.equip(0, 'longbow', ['arrow','flame'])
  equip: (slot, id, bits, p) => {
    const q = p || player, cell = makeTool(id);
    (bits || []).forEach((b, i) => { if (i < cell.bits.length) cell.bits[i] = b; });
    sortBits(cell);
    q.tools[slot] = cell;
    return cell;
  },
  setNock: (t, p) => { (p || player).nockT = t; }, // a huge t parks a player's bow for a capture
  // the players: all ten, the local one, and the teams table
  players, MAX_PLAYERS, TEAMS, Player, ringPts, contestRank,
  // the eagle drop: the live flight records, force a jump, or fly the route from scratch
  get drop() { return state.drop; }, beginDrop, dropJump: (p) => dropJump(p || player, true), landPlayer, makeEagleRoute, makeEagles, inAir,
  hopOff: (p) => hopOff(p || player), // E off the roost for a rider who rode the landing (refused while the brief runs)
  // the two objectives: read them, chip one, or fell one outright without a siege
  get eagles() { return state.drop && state.drop.eagles; },
  // Perch's painter, every bird skin (js/sprites/perch.js); wear one with PROFILE.wear('bird', id)
  perch: SPRITES.perch,
  // the paint: which preset a team wears on this screen (settings.teamBlue), and the two merchants
  skin, get merchants() { return robots.filter((b) => b.merchant); },
  // the roost's road out: the felling front, or fire the whole lane at once
  spurs, roadNest, roadSpan, roadDist, roadMainDist, laneDist, findCrashPoint, // the road system: the spur registry, a side's nest and junction, the gates, the three distances (laneDist: as laid, ended at the cistern), and where a bird would land
  creekAt, creekFlow, creekWet, creekBends, creekOuterFords, waterAt, CQ, // the creek: the distance to its banks (CQ holds where), the current, the plunge test, the bends and the fixed fords
  cisternR, cisternDist, cisternReach, cisternTile, cisternBlocks, cisternTouches, // the cistern (js/cistern.js): tiles from the crossing, px to its stone, how much of a step it lets a body take, and its three tile reads
  zips, zipPoint, zipNearest, zipNear, zipStart, zipEnd, zipToggle,  // the ziplines (js/zipline.js): both lines, a point along one, the nearest point to a body, and the ride's own verbs
  landmarks, LANDMARKS, // the story landmarks (landmarks.js): every one stood, and the table
  planLane, laneStep: (team, dt) => { const e = state.drop.eagles[team]; if (e.lane) laneStep(e, dt == null ? 99 : dt); return e.lane; },
  hurtEagle: (team, dmg, src) => { const e = state.drop.eagles[team]; hurtEagle(e, dmg == null ? 25 : dmg, src); return e; },
  eagleFlee: (team, src) => eagleFlee(state.drop.eagles[team], src),
  teamEagleDown,
  get player() { return player; },
  get inv() { return player.inv; },
  // the backpack: the item table, the slot array, and add/take/count without
  // walking onto a drop. bagHit is what the pointer tests against; food is a
  // POUCH and takes no cell, so `food` is where a berry actually sits, and
  // goldCellRect is the always-on gold readout on the hud strip.
  ITEMS, BAG_CAP, bagFrameRect, bagTabRect, bagCellRect, bagHit, goldCellRect, foodCellRect, shortNum, useCard: (p) => useCard(p || player),
  get bagEase() { return bagEase; },
  // the drag, and what it answers with: the armed press, the three moves, the
  // cue/rumble/pulse raiser, and what a release on a given well WOULD do -
  // so a driver can prove the promise and the move agree without a mouse
  dragLift, dragDrop, dragReturn, hudPress, hudRelease, hudFx, haptic,
  dropKindBag, dropKindSlot: (i) => dropKindSlot(i || 0), dropKindBit,
  get wellLit() { return wellLit; }, get dragLit() { return dragLit; },
  get bag() { return player.bag; },
  get food() { return player.food; },
  bagAdd: (type, n, p) => bagAdd(p || player, type, n || 1),
  bagTake: (type, n, p) => bagTake(p || player, type, n || 1),
  bagCount: (type, p) => bagCount(p || player, type),
  bagRoom: (type, p) => bagRoom(p || player, type),
  bagUsed: (p) => bagUsed(p || player),
  // hand a player to an AI, a human, or nobody (a ghost at its camp)
  setControl: (id, mode) => { const p = players[id]; if (p) p.control = mode; return p; },
  // reseat this screen's player in slot `id` (a fresh roster: bots and bags
  // reset), the camera on it - the same thing ?local=N does at load
  setLocal: (id) => { initPlayers(undefined, id); camX = player.x - WV_W / 2; camY = player.y - WV_H / 2; return player; },
  localId: () => localId,
  // the snapshot and its echo harness (js/net/snapshot.js): netEcho() renders,
  // snapshots, blanks, applies and renders again - a nonzero diff is a field
  // the schema is missing; netEchoRun(ticks, every) does it along a run
  netEcho, netEchoRun, snapBuild, snapApply, snapSize, NET, netSetup,
  // the two-tab match: role, peers, bytes each way, the newest snapshot tick
  netStatus: () => ({ role: NET.role, peers: [...NET.peers.values()].map((q) => q.slot), parked: NET.parked.size, synced: NET.synced, lastTick: NET.lastTick, bytesIn: NET.bytesIn, bytesOut: NET.bytesOut, bpsIn: NET.bpsIn, bpsOut: NET.bpsOut, hostOver: NET.hostOver, refused: NET.refused || null, open: !!(NET.transport && NET.transport.open), lobby: NET.transport && NET.transport.lobbyId || null, room: NET.transport && NET.transport.room || null, transportError: NET.transport && NET.transport.error || null, verify: NET.verify, verifyFail: NET.verifyFail, acks: [...NET.peers.values()].map((q) => q.ack), hist: snapShadow.hist.length, lossOut: NET.lossOut, dropped: NET.dropped, fulls: NET.fulls, framesLost: NET.transport && NET.transport.lost || 0 }),
  // the wire form's own proofs: netDeltaRun(ticks, every) sends `ticks` of this
  // page's sim as binary deltas and applies them back, comparing against the
  // full form after each; netVerify(on) makes a host ride its full form along
  // every VERIFY_EVERY ticks so each client checks itself (netStatus().verifyFail)
  netDeltaRun, netVerify: (on) => { NET.verify = !!on; return NET.verify; }, netLoss: (f) => { NET.lossOut = +f || 0; return NET.lossOut; }, snapHistoryPush, snapDeltaFrom, snapBuildDelta, snapEncode, snapDecode, encDict,
  // the wrapper's lobbies, for a joiner picking one by hand (steamBridge only)
  lobbies: () => (window.steamBridge ? window.steamBridge.lobbies() : Promise.resolve([])),
  placeObj, idx, objAt, hoverFish, damagePlayer, die, endMatch, specNext, aliveCount, updateAI, contest,
  // the post-game lobby (js/ui/lobby.js): freeze the table by hand, open the
  // screen without walking a ceremony, drive it, and read back both the
  // frozen record and the live screen state
  statFreeze, sampleStats, openScores, scoresLayout, scoresHit, scoresKey, scoresClick, scores,
  get matchStats() { return matchStats; },
  // the two end screens: their timelines, the frozen numbers they print, and
  // a way to open the loss summary without pressing its plank. Set
  // state.defeatT / state.deadTimer to scrub either ceremony to a beat.
  WIN_T, DEF_T, openDefeat, endSnapshot, endScreen, deadLayout, deadHit, deadActivate, respawnTime,
  // ...and their emote bar: the table, where its plates sit, what the pointer
  // is on, and a way to play one without a key (DBG.emotePlay(0..3))
  EMOTES, EM_T, emoteLayout, emoteHit, emotePlay, emoteLive,
  // the replay window's rect this frame, its close box, and whether the pointer is on it
  rpRect, rpCloseRect, rpCloseHit,
  // routes: the search itself, and showPaths = true draws every unit's live route
  findPath, walkable, navTo, showPaths: false,
  // hero levels: pay a player gold (and XP) the way a pickup would
  gainGold: (n, p) => gainGold(p || player, n), LEVEL_XP, LEVEL_MAX,
  // the stat ledger, the sheet that flies into the notice lane when a number
  // moves (the `stat ledger` block, js/ui/shop.js): the table every surface
  // prices a body with, the plate's own size, the live values, what each row
  // is still lit for, and the raise without a change behind it - so a driver
  // can prove a level, a card or a gear buy moved the number it was meant to
  GEAR_STATS, STAT_W, statPlateH, raiseStatNote, noteLaneFloor,
  statValues: (p) => GEAR_STATS.map(([n, get, fmt]) => [n, fmt(get(kitOf(p || player), p || player))]),
  statLit: () => GEAR_STATS.map(([n], i) => (statLit[i] ? [n, statDeltaTxt(statLit[i].d, GEAR_STATS[i][2]), statLit[i].t] : null)).filter(Boolean),
  // gear: the table, a player's effective kit, and buy/pick without the HUD
  GEAR, GEAR_SLOTS, GEAR_COSTS, kitOf, refreshKit, gearHit, charLayout, charHit, BAG_CELL,
  gearCost: (i, p) => gearCost(p || player, i),
  buyGear: (i, p) => buyGear(p || player, i),
  pickGear: (i, v) => pickGear(i, v), spendPt, heroLayout, heroScreenHit, beginHero,
  setGear: (i, v, p) => { const q = p || player; q.gear[i] = v; refreshKit(q); return q.kit; },
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
  clickAction: (p) => clickAction(p || player),
  tryWork: (p) => tryWork(p || player),
  workTarget: (p) => workTarget(p || player),
  tryDodge: (p) => tryDodge(p || player),
  // status effects (js/actions.js): the one blow every kind of unit takes,
  // every state one can be put under, and the two lists an area effect
  // sweeps. `e` defaults to the local player wherever it is the last argument.
  hurtUnit, unitsNear, unitsHit, unitMoveMul, unitFoe, unitAlive, sideOf, clearUnitStatus,
  rootUnit: (t, e) => rootUnit(e || player, t),
  slowUnit: (t, mul, e) => slowUnit(e || player, t, mul),
  netUnit: (t, mul, e) => netUnit(e || player, t, mul),
  markUnit: (t, e) => markUnit(e || player, t),
  // fire: light a body, put it out, and the numbers a burn runs on
  igniteUnit: (t, dps, e, src) => igniteUnit(e || player, t, dps, src === undefined ? player : src),
  douseUnit: (e) => douseUnit(e || player),
  DMG_TYPES, BURN_T, BURN_DPS, BURN_TICK, BURN_MAX, PYRE_T, PYRE_DPS, CINDER_R,
  // the roll as a hit: stun anything by hand, and read back what a roll at a
  // given speed would deal (`.` draws the sweep circle over a live dash)
  stunUnit: (t, e) => stunUnit(e || player, t),
  rollDmg: (sp, p) => rollDmg(p || player, sp),
  rollSweep: (p) => rollSweep(p || player),
  ROLL_HIT_R, ROLL_FAST, ROLL_DMG, ROLL_STUN, TACKLE_STUN, TACKLE_SELF, TACKLE_MIN,
  // prone: the burrow toggle, how buried a player reads to anything hunting it,
  // and a way to stage a fully covered body without lying in the snow for 1.5s
  tryProne: (p) => tryProne(p || player),
  risePlayer: (p) => risePlayer(p || player),
  concealOf: (p) => concealOf(p || player),
  seenAt: (range, p) => seenAt(p || player, range),
  ambushReady: (p) => ambushReady(p || player),
  setHide: (h, p) => {
    const q = p || player;
    q.hide = Math.max(0, Math.min(1, h));
    q.prone = q.hide > 0 || q.prone;
    return q.hide;
  },
  PRONE_BURY, PRONE_SPEED, PRONE_SNIFF, PRONE_CUT, PRONE_MOVE, PRONE_MAP, AMBUSH_MUL,
  spawnAnimal: (kind, x, y) => { const a = makeAnimal(kind, x, y); animals.push(a); return a; },
  // the level a spawn is dealt (the table's average), the two deer's lines
  // and their restock (which a driver can call by hand to run one now)
  animalLevel, updatePreyStock, spawnDeer, get deerRoutes() { return deerRoutes; },
  // debug staging: place a construction site directly, no cost or validation
  buildStruct: (tx, ty, type, tier, rot) => {
    const t = Math.min(STRUCTS[type].tiers.length - 1, tier || 0);
    return createStruct(tx, ty, type, t, player, true, rot); // anchor = top-left for a big footprint
  },
  findSite, structOf, footprint,
  // the build list and its ghost: the one placement rule, the list's order
  // and reach, what the ghost snaps to right now, and the building E manages
  canPlaceAt, BUILD_ORDER, BUILD_REACH, buildGhostAt, manageNear, placeStruct,
  // ...and the hammer plate that opens it, the rows under it (1x corner
  // space - the hit tests take the pointer's own), and the one toggle
  buildTabRect, buildRowRect, buildListHit, toggleBuild,
  finishBuild: (o) => { if (o && o.building) o.buildT = o.buildTotal; },
  // z is a world scale; it lands on the nearest pixel-exact rung, as the
  // wheel does. snap skips the ease. setK sets the rung itself.
  setZoom: (z, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), Math.round((+z || 1) * devScale))); if (snap) applyZoom(0, true); },
  setK: (k, snap) => { kWant = Math.max(kMin(), Math.min(kMax(), k | 0)); if (snap) applyZoom(0, true); },
  getZoom: () => ({ want: zoomWantOf(), applied: zoomCur, k: kWant, devScale, exact: Math.abs(zoomCur * devScale - Math.round(zoomCur * devScale)) < 1e-6,
    rungs: (() => { const r = []; for (let k = kMin(); k <= kMax(); k++) r.push(+(k / devScale).toFixed(4)); return r; })(),
    wv: [WV_W, WV_H], mm: mmScale() }),
  setSwing: (i, p) => { (p || player).swing = i; },
  getSwing: (p) => (p || player).swing,
  cam: () => ({ x: camX, y: camY }),
  // the day's weather: weather('blizzard') pins one (fading to it like a dawn
  // would; weather() lets the day decide again), wx the dials in force now,
  // weatherOf(day) what a day rolls on this seed
  weather: (name) => { state.wxForce = name && WEATHERS[name] ? name : null; },
  get wx() { return weatherNow(); }, weatherOf,
  startGame, beginIntro, beginLobby, lockIn, pressPlay, cancelCount, setAiLevel, lobbyLayout, AI_LEVELS, AI_ALLIES, aiProfile, setClass, CLASSES, menu: state.menu, menuHit, menuClick, menuKey, lobbyHit,
  // the ESC panel: what the pointer is over, the speaker's plate, the open
  // page's row anchors (already scrolled - a row's y is where it is on
  // screen) and the navbar cells - so a driver can click a dial without
  // guessing at the pitch. setSettingsTab flips the page directly, and
  // ctrlCvs holds the CONTROLS page's three bakes (keys / pad / touch) -
  // blit one scaled to read the weapon primer's pixels without squinting at
  // a 240px page; setCtrlTab picks which listing the page shows.
  settingsHit, muteBtnRect, settingsScrollBy, ctrlCvs,
  setSettingsTab: (id) => { setTab = id; },
  get settingsTab() { return setTab; }, // the open page (a let, so a getter)
  setCtrlTab: (id) => { ctrlTab = id; },
  // the key binds: the action table, the live map, the rebind by hand
  // (setBind swaps exactly as a listening cap would), and keyName - which
  // reads a KeyboardEvent, or a bare {code, key}, the way the listener does,
  // so an AZERTY board can be staged without one. keyRows is where every
  // cap on the CONTROLS page sits, listing-local.
  KEY_ACTIONS, setBind, resetBinds, rebindStart, keyName, keyLabel, keyCap, mendBinds,
  get binds() { return binds(); }, // the live scheme's map
  // the CLICK scheme (input.js): its state, the two presses and the pickers
  ck, ckOn, ckClear, ckRightPress, ckRightRelease, ckArmedPress, ckReach: (p) => ckReach(p || player),
  // the MOUSE scheme (input.js, the `mouse only` banner): its state and presses
  ms, msOn, msWell, msWheelPress, msWheelRelease, pointerPress, pointerRelease,
  ckAcquire: (p) => ckAcquire(p || player), ckSees: (t, p) => ckSees(p || player, t), unitUnder, mmWorldAt,
  // the entry points a pad presses through, and their held state
  keyPress, keyRelease, actHeld, settingsLayout,
  keyRows: () => keyRowsLayout(),
  get settingsRows() {
    const L = settingsLayout();
    const rows = {};
    for (const r of L.rows) rows[r.id] = r.y - L.scroll;
    return { tab: setTab, tabs: L.tabs, rows, scroll: L.scroll, maxScroll: L.maxScroll,
      x: SL_X, w: SL_W, panel: { x: SET_X, y: SET_Y, w: SET_W, h: SET_H } };
  },
  layout: () => ({ VIEW_W, VIEW_H, SET_X, SET_Y, SL_X, PANEL_X, PANEL_Y, MM_CX, MM_CY }),
  hideUI: false,
  // director mode (js/director.js): its state, and its keys as pressed
  director, directorKey: (key) => keyPress({ key, repeat: false, char: key }),
  // saved matches (js/save.js): the record, the hash the replay proof compares, a slot by hand
  saveCapture, saveApply, saveHash, saveMatch, loadSave, saveList, autoSave,
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
// that is the step the game was tuned under - TOOL_ROF_STEP counts rate of
// fire in it, and the integrators have only ever seen 16 ms - so the feel
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
  for (const d of drops) w.push(d, d.x, d.y);
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
function loop(nowMs) {
  if (capSkips(nowMs)) {
    if (!document.hidden) requestAnimationFrame(loop);
    else watchHidden();
    return;
  }
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
    padPoll(dt);   // the sticks have no events: read them once a frame, before the steps
    const spd = ladderWatch ? ladderWatch.speed : 1; // a watched bot match runs faster on request (js/ui/ladder.js)
    tickAcc += dt * spd;
    let n = 0;
    const t0 = performance.now();
    while (tickAcc >= TICK_DT - TICK_SLACK && n < TICK_MAX * spd) {
      tweenMark();
      update(TICK_DT);
      tickAcc -= TICK_DT;
      n++;
    }
    if (n === TICK_MAX * spd && tickAcc > 0) tickAcc = 0; // the stall's remainder is dropped, not owed
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
    saveAutoTick(); // a timed autosave, off the match clock (js/save.js)
  }
  if (!document.hidden) requestAnimationFrame(loop); // hidden: the worker calls loop() instead
  else watchHidden();
}
pageListenStart(); // keys, mouse and resize reach the game only now that every global stands (js/core.js)
requestAnimationFrame(loop);
