// Softfall - a cozy winter survival game.
'use strict';
// The last file to load: the boot order, window.DBG and the
// requestAnimationFrame loop. The eagle drop it starts is js/sim/eagle.js.

// ------------------------------------------------------------ boot
function startGame() {
  SFX.unlock();
  beginDrop();
}

PROFILE.load();   // the profile carries the settings, so it is read first
loadSettings();
mendBinds(); // the profile's key binds made whole (input.js)
fitCanvas(); relayout(); // the window may have changed size while the scripts loaded (no resize listener yet); this places the UI for the fitted view
SFX.setVolume(settings.volume);
SFX.setMusicVolume(settings.musicVol);
SFX.setSfxVolume(settings.sfxVol);
SFX.setMuted(settings.muted);
// the title track. Browsers refuse audio before a gesture, so SFX.music holds
// this as pending and the first click or keypress starts it (see js/app/audio.js).
SFX.music.play('intro', { in: 1.5 });
if (PRACTICE) {
  // the training field (the `practice arena` banner, js/sim/practice.js): a fixed
  // room instead of a match world - one dummy, open targets, the ice parkour,
  // and nothing that spawns or restocks: no camps, wildlife or
  // eagles at all
  genPracticeWorld();
} else {
  genWorld();
  placeCreek();     // the creek down the cross-diagonal, its bends and fords, and the cistern round its frozen middle (world.js, cistern.js)
  layLanes();       // ...and the top and bot lanes, forded where they cross it (js/sim/lanes.js)
  placeRoad();       // the diagonal lane, and the side lanes with it (world.js)
  placeBase();       // ...and each side's hollow round the end of it, where its bird roosts (js/sim/base.js)
  placeZips();       // ...and each side's cable along it (js/sim/zipline.js)
  placeTowers();     // ...and two road towers on each side's cable, which it is cut back to (js/sim/towers.js)
  placeCamps();      // worldgen's last pass, before the ground is baked: the camps clear their sites
  liftRocks();       // ...then genWorld's placeholder rocks come up again (world.js)
  placeLandmarks();  // ...and the story landmarks take their spots, on a stream of their own (landmarks.js)
  placePumps();      // ...and the two gold pumps beside the top and bot lanes' middles, with no rng() (js/sim/pumps.js)
  placeBushes();     // ...and the berry bushes move to the camps and the river, on no rng at all (world.js)
  spawnAnimals();
  spawnFish();
  spawnOrca();       // ...and the orca under its lake (js/sim/orca.js)
  stockCamps();      // the monsters go in once the world is standing
}
layDrifts();         // the snow's depth, in the lee of everything worldgen stood up (js/sim/depth.js)
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
// ...and a page reloaded onto a party's seed to join it (joinRoom, js/ui/rooms.js),
// a Steam invite, or a rematch walks straight into the party lobby with that join under way
const JOIN_AT_BOOT = (function () { const j = /[?&]join=([A-Z0-9]+)/i.exec(location.search); return j ? j[1].toUpperCase() : null; })();
// the replay proof (js/sim/save.js): the valley as it grew is the baseline every
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
// parked in the corner forest (practiceVacate, js/sim/practice.js); the local
// player takes the arena's spawn tile and the HUD slides in the way a landing's
// does. A party's friends take seats as they join (netHostHello).
if (PRACTICE) {
  for (const p of players) if (p !== player) practiceVacate(p);
  practiceSeat(player);
  // early morning, forever: sim.js never advances state.time under PRACTICE,
  // so this is the arena's one fixed hour - crisp daylight, shadowless dawn
  state.time = 0;
  state.mode = 'play';
  camX = Math.max(0, Math.min(WORLD * TILE - WV_W, player.x - WV_W / 2));
  camY = Math.max(0, Math.min(WORLD * TILE - WV_H, player.y - WV_H / 2));
  state.introFrom = { x: camX, y: camY };
  state.intro = HUD_IN_T; state.introLen = HUD_IN_T;
}
if (JOIN_AT_BOOT && !PRACTICE) partyBootJoin(JOIN_AT_BOOT); // the party screen, the join under way (js/ui/rooms.js)
else if (JOIN_AT_BOOT) practiceBootJoin(JOIN_AT_BOOT); // a party's guest following its leader onto the field
if (PRACTICE) practiceBootHost(); else rematchBootHost(); // a leader back from a match or the field: the party again, same people (js/ui/rooms.js)
// landing from a reload that whited out (a rematch, the field left): the white clears to the new world
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
  fish, holes, addFish, spawnEmerger,
  // the ice breaking in its own shape (js/sim/icebreak.js): DBG.iceBreak(x, y, 'breach', 0, { warn: 0.9 })
  iceBreaks, iceBreak, iceBreakAge, iceBreakCovers, iceBreakHolds, iceBreakWet, ICE_BREAK_SHAPES,
  // the orca and its lake (js/sim/orca.js, js/sim/world.js): its state, the line over a head, the disc
  orca, orcaLine, orcaAge, orcaShore, orcaLakeAt, orcaLakeEdge, ORCA_LINE,
  // the camps: the live registry, the table behind it, where each site is,
  // what is where, restock by hand, and give a player a bear buff by hand (campBuff(p, t, 'alpha' | 'dire'))
  camps, CAMPS, CAMP_SITES, campSites, campTile, campAt, stockCamps, campBuff, flushBirds,
  // the top and bot lanes (js/sim/lanes.js): a centreline, its distance, a march down one, and the hollows' gates and bay spots
  laneLine, sideLaneDist, laneWaypoints, baseGate, baseBaySpot,
  // the snow's depth (js/sim/depth.js): the map, the deep band, the drifts and the wind that laid them
  snowDepth, deepAt, drifts, driftWind,
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
  // the other controller (js/app/gamepad.js): its live state
  pad, padActive,
  // the local profile: the store itself, the profile card (js/ui/profile-card.js)
  // and the hero row (js/ui/heroes.js), so a driver can rename, pick and read back
  PROFILE, beginProfile, leaveProfile, profileCommit, profileKey, profileHit, profileLayout, profileTagRect, overProfileTag,
  applyProfile, heroList, lobbyPick, beginSkins, skinsLayout, birdSkinFor, coinTagRect, setCoins: (n) => PROFILE.setCoins(n),
  // the radial wheel: open one by hand (state.wheel) and read back the
  // geometry the hover test and the pixels both use
  wheelLayout, wheelSpan, wheelAng, WHEEL_HUB, WHEEL_R, WHEEL_RING,
  structures, robots, arrows, STRUCTS, SWING_TOOLS,
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
  // the renock it waits, the press itself, and its damage at a draw - so a
  // driver can land one without holding the button.
  attackOf: (p) => attackOf(p || player), attackCycle: (p) => attackCycle(p || player),
  basicAttack: (p) => basicAttack(p || player), attackDmg: (pw, p) => attackDmg(p || player, pw == null ? 1 : pw, false),
  drawTime,
  // a drop on the snow, so a driver can stage a pickup
  // death keeps everything (die): the one number a kill is worth
  get KILL_BOUNTY() { return killBounty(); },
  // the draw curve: 0..1 off a player's chargeT, and the flight and damage it buys a shot
  drawPow, shotFlight, drawDmgMul, DRAW_RANGE_MIN, DRAW_SPEED_MIN, DRAW_DMG_MIN,
  cellPlate, chopTree,
  // the class abilities: the table, a keypress by hand, and the entity lists
  // an ability leaves in the world - so a driver can stage a crater or a net
  // without walking a bot into one
  CLASS_AB, abCraters: craters, abNets: nets,
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
  BUILD_ITEMS, ITEM_PARTS, ITEM_DONE, ITEM_ALL, itemTier, itemInto, shopRecommended, itemCost: (id, p) => itemCost(p || player, id),
  buyItem: (id, p) => buyItem(p || player, id), sellItem: (slot, p) => sellItem(p || player, slot),
  botNextItem, botItemBuy,
  // the heals: the potion's slot and its drink, a creek fish's heal and the bushes'
  potionSlot: (p) => potionSlot(p || player), useItem: (slot, p) => useItem(p || player, slot),
  POTION_HEAL, POTION_T, CREEK_FISH_HEAL, BUSH_HEAL, BUSH_REGROW, creekFishN, creekFishAt, placeBushes,
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
  // the players: all ten, the local one, and the teams table
  players, MAX_PLAYERS, TEAMS, Player, ringPts, contestRank,
  // the eagle drop: the live flight records, or fly the birds in from scratch
  get drop() { return state.drop; }, beginDrop, landPlayer, hopOff, makeEagles, inAir,
  hopOff: (p) => hopOff(p || player), // E off the roost for a rider who rode the landing (refused while the brief runs)
  // the two objectives: read them, chip one, or fell one outright without a siege
  get eagles() { return state.drop && state.drop.eagles; },
  // Perch's painter, every bird skin (js/sprites/perch.js); wear one with PROFILE.wear('bird', id)
  perch: SPRITES.perch,
  // the paint: which preset a team wears on this screen (settings.teamBlue), and the two merchants
  skin, get merchants() { return robots.filter((b) => b.merchant); },
  // the road and the bases (js/sim/base.js)
  pads, roadNest, roadSpan, roadDist, roadMainDist, laneDist, findCrashPoint, // the road system: the crash pads, a side's nest and junction, the gates, the three distances (laneDist: as laid, ended on the perches and at the cistern), and where a bird lands
  baseAt, baseCentre, basePerch, BASE_R, // the bases: whose hollow a tile is in, its centre, its perch, its radius
  creekAt, creekFlow, creekWet, creekBends, creekOuterFords, waterAt, CQ, // the creek: the distance to its banks (CQ holds where), the current, the plunge test, the bends and the fixed fords
  cisternR, cisternDist, cisternReach, cisternTile, cisternBlocks, cisternTouches, // the cistern (js/sim/cistern.js): tiles from the crossing, px to its stone, how much of a step it lets a body take, and its three tile reads
  zips, zipPoint, zipNearest, zipNear, zipStart, zipEnd, zipToggle,  // the ziplines (js/sim/zipline.js): both lines, a point along one, the nearest point to a body, and the ride's own verbs
  landmarks, LANDMARKS, // the story landmarks (landmarks.js): every one stood, and the table
  hurtEagle: (team, dmg, src) => { const e = state.drop.eagles[team]; hurtEagle(e, dmg == null ? 25 : dmg, src); return e; },
  eagleFlee: (team, src) => eagleFlee(state.drop.eagles[team], src),
  teamEagleDown,
  get player() { return player; },
  get inv() { return player.inv; },
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
  netStatus: () => ({ role: NET.role, peers: [...NET.peers.values()].map((q) => q.slot), parked: NET.parked.size, synced: NET.synced, lastTick: NET.lastTick, bytesIn: NET.bytesIn, bytesOut: NET.bytesOut, bpsIn: NET.bpsIn, bpsOut: NET.bpsOut, hostOver: NET.hostOver, refused: NET.refused || null, open: !!(NET.transport && NET.transport.open), lobby: NET.transport && NET.transport.lobbyId || null, room: NET.transport && NET.transport.room || null, transportError: NET.transport && NET.transport.error || null, verify: NET.verify, verifyFail: NET.verifyFail, acks: [...NET.peers.values()].map((q) => q.ack), hist: snapShadow.hist.length, lossOut: NET.lossOut, dropped: NET.dropped, fulls: NET.fulls, framesLost: NET.transport && NET.transport.lost || 0 }),
  // the wire form's own proofs: netDeltaRun(ticks, every) sends `ticks` of this
  // page's sim as binary deltas and applies them back, comparing against the
  // full form after each; netVerify(on) makes a host ride its full form along
  // every VERIFY_EVERY ticks so each client checks itself (netStatus().verifyFail)
  netDeltaRun, netVerify: (on) => { NET.verify = !!on; return NET.verify; }, netLoss: (f) => { NET.lossOut = +f || 0; return NET.lossOut; }, snapHistoryPush, snapDeltaFrom, snapBuildDelta, snapEncode, snapDecode, encDict,
  // the wrapper's lobbies, for a joiner picking one by hand (steamBridge only)
  lobbies: () => (window.steamBridge ? window.steamBridge.lobbies() : Promise.resolve([])),
  placeObj, idx, objAt, damagePlayer, die, endMatch, specNext, aliveCount, updateAI, contest,
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
  clickAction: (p) => clickAction(p || player),
  tryWork: (p) => tryWork(p || player),
  workTarget: (p) => workTarget(p || player),
  tryDodge: (p) => tryDodge(p || player),
  // status effects (js/sim/actions.js): the one blow every kind of unit takes,
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
  DMG_TYPES, BURN_T, BURN_DPS, BURN_TICK, BURN_MAX,
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
  // the fog of war (js/sim/fog.js): fog = false lifts it for a debug look;
  // inSight(team, u) is what that side sees, fogShown(u) what this screen draws
  fog: true, inSight, fogShown: (u) => fogShown(u),
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
  buildStruct: (tx, ty, type, tier) => {
    const t = Math.min(STRUCTS[type].tiers.length - 1, tier || 0);
    return createStruct(tx, ty, type, t, player, true); // anchor = top-left for a big footprint
  },
  structOf, footprint,
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
  startGame, beginIntro, beginLobby, lockIn, pressPlay, setAiLevel, DRAFT, draftAct, draftPoint, draftConfirm, lobbyLayout, AI_LEVELS, AI_ALLIES, aiProfile, setClass, CLASSES, menu: state.menu, menuHit, menuClick, menuKey, lobbyHit,
  // the ESC panel: what the pointer is over, the speaker's plate, the open
  // page's row anchors (already scrolled - a row's y is where it is on
  // screen) and the navbar cells - so a driver can click a dial without
  // guessing at the pitch. setSettingsTab flips the page directly, and
  // ctrlCvs holds the CONTROLS page's three bakes (keys / pad / touch) -
  // blit one scaled to read its pixels without squinting at a 240px page;
  // setCtrlTab picks which listing the page shows.
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
  if (!document.hidden) requestAnimationFrame(loop); // hidden: the worker calls loop() instead
  else watchHidden();
}
pageListenStart(); // keys, mouse and resize reach the game only now that every global stands (js/sim/core.js)
requestAnimationFrame(loop);
