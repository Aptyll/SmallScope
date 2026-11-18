'use strict';
// ------------------------------------------------------------ draft rules
// The hero select's DRAFT (the lobby, js/ui/champ-select.js), the way every party
// reaches the eagle: one QUICK PICK, all six seats at once, on one clock of
// DRAFT_PICK_T that ends on the reveal's last COUNT_T to the drop. The host keeps
// the draft and every screen draws its copy (DRAFT); a guest points and confirms
// through the host (`draft` messages, js/net/net.js) like any other press.
//
// No bans and no turns. FIRST COME, FIRST SERVED: a hero a person has locked,
// on either side, is out for everyone else (draftCanLock), so every lock shows
// on every screen at once; what a seat only points at stays its own side's.
// Bots lock the moment the pick opens and give a hero up when a person locks
// it (draftYield), so a bot never takes a hero from a person. Once every seat
// has locked, the clock jumps to its last COUNT_T (draftCheck); a seat that
// never locked gets a hero at random from those still free (draftReveal), even
// if it was pointing at one. The draft is not sim state: it lives and ends on
// the title, and its result is the class each player flies out with.
const DRAFT_PICK_T = 15;       // s: the whole pick, the reveal's count (COUNT_T) included
const DRAFT_RANGED = 2;        // a bot's side wants about this many heroes at range
const DRAFT = {
  phase: 'off',                // 'off' | 'wait' (a guest before the host's first word) | 'pick' | 'done'
  t: 0,                        // s left on the pick's clock (the reveal comes at COUNT_T)
  cls0: [],                    // per seat: the hero it came in on (a person's own main)
  hover: [],                   // per seat: the hero it points at, -1 none (a guest sees -1 for a rival)
  lock: [],                    // per seat: the hero it confirmed, -1 none
  role: [],                    // per seat: its POSITIONS index (your side's; a rival's is -1 on a guest)
  fx: 0,                       // s: the flash as the pick opens
};
// the pick's clock: a FIRST MATCH has none - someone new reads a hero or two (the brief, js/ui/select.js)
// and the pick waits for their LOCK IN; it is the one screen nobody else is waiting on (bots only)
function draftPickT() { return NET.mode === 'guide' ? Infinity : DRAFT_PICK_T; }
function draftOpen() { return DRAFT.phase === 'pick'; }
function draftHiding() { return draftOpen() || DRAFT.phase === 'wait'; }
function heroRanged(h) { return !!CLASSES[h].attack.shot; }
function draftMates(p) { return players.filter((q) => q.active && q.team === p.team && q !== p); }
// the hero a seat stands behind: its lock, else what it points at
function draftWant(i) { return DRAFT.lock[i] >= 0 ? DRAFT.lock[i] : DRAFT.hover[i]; }
// the person, on either side, who has locked hero h (a bot's hero is never in a person's way: it gives it up)
function draftHolder(h) { return players.find((q) => q.active && isHuman(q) && DRAFT.lock[q.id] === h) || null; }
// every hero is locked by a person: repeats are back (a roster smaller than the seats)
function draftAllHeld() {
  for (let h = 0; h < CLASSES.length; h++) if (!draftHolder(h)) return false;
  return true;
}
// may p lock hero h: no other person holds it
function draftCanLock(p, h) {
  if (!(h >= 0 && h < CLASSES.length)) return false;
  const q = draftHolder(h);
  return !q || q === p || draftAllHeld();
}

// ------------------------------------------------------------ draft roles
// The three POSITIONS (js/sim/player.js), one per seat on each side,
// handed out as the draft opens (draftSeatRoles): the people first, each on
// the one their profile asks for (PROFILE.pos; a guest's rides its hello,
// NET.pos) when nobody earlier on the side took it, then any free one, the
// bots last. A seat may move to another position all through the draft
// (draftSwapRole): a bot holding it trades, a person keeps theirs. A hero
// has no position of its own: any hero plays any of them, and the seat's
// goes into the match (draftReveal: p.position), where a bot plays it
// (js/ai/ai-farm.js). Your side's positions are yours to see, the rivals' never.
const DRAFT_ACTS = ['hover', 'lock', 'role', 'skin']; // what a guest's `draft` press may be
function posAsk(p) { const r = p === player ? PROFILE.pos() : NET.pos[p.id]; return r >= 0 ? r : -1; }
function draftSeatRoles() {
  const role = players.map(() => -1);
  for (const team of [0, 1]) {
    const side = players.filter((q) => q.active && q.team === team), free = POSITIONS.map((_, i) => i);
    const take = (q, r) => { role[q.id] = r; free.splice(free.indexOf(r), 1); };
    for (const q of side) if (isHuman(q) && free.includes(posAsk(q))) take(q, posAsk(q));
    for (const people of [true, false]) for (const q of side) if (role[q.id] < 0 && isHuman(q) === people && free.length) take(q, free[0]);
  }
  return role;
}
// the host's: slot moves to position r, trading with a bot of its side that
// holds it (which keeps its hero: any hero plays any position)
function draftSwapRole(slot, r) {
  const D = DRAFT, p = players[slot];
  if (!p || !(r >= 0 && r < POSITIONS.length) || D.role[slot] === r) return false;
  const q = players.find((o) => o.team === p.team && o !== p && D.role[o.id] === r);
  if (q && isHuman(q)) return false;
  if (q) D.role[q.id] = D.role[slot];
  D.role[slot] = r;
  draftSend();
  return true;
}

// ------------------------------------------------------------ draft bots
// A bot picks a hero nobody holds yet - a person's lock or point counts as
// theirs - leaning to the shape its side lacks (about DRAFT_RANGED at range)
function draftBotPick(p) {
  const held = (q) => DRAFT.lock[q.id] >= 0 ? DRAFT.lock[q.id] : isHuman(q) ? DRAFT.hover[q.id] : -1;
  const others = players.filter((q) => q.active && q !== p);
  const ranged = draftMates(p).filter((q) => held(q) >= 0 && heroRanged(held(q))).length;
  const want = ranged < DRAFT_RANGED;
  let best = [], low = Infinity;
  for (let h = 0; h < CLASSES.length; h++) {
    const s = others.filter((q) => held(q) === h).length * 4 + (heroRanged(h) === want ? 0 : 1);
    if (s < low) { low = s; best = [h]; } else if (s === low) best.push(h);
  }
  return best.length ? best[Math.floor(Math.random() * best.length)] : 0;
}
// a person locked h: a bot on either side holding it picks again
function draftYield(p, h) {
  for (const q of players) if (q.active && q !== p && !isHuman(q) && DRAFT.lock[q.id] === h) {
    DRAFT.lock[q.id] = -1; DRAFT.hover[q.id] = -1;
    const k = draftBotPick(q);
    DRAFT.lock[q.id] = DRAFT.hover[q.id] = k;
  }
}
// a hero at random from those nobody has locked (any, once every one is held)
function draftRandom() {
  const free = CLASSES.map((_, h) => h).filter((h) => !players.some((q) => q.active && DRAFT.lock[q.id] === h));
  const from = free.length ? free : CLASSES.map((_, h) => h);
  return from[Math.floor(Math.random() * from.length)];
}

// ------------------------------------------------------------ draft flow
// The host's: beginLobby opens it, updateTitle runs its clock, and the end of
// the pick turns every seat's hero on and starts the count. A guest waits for
// the host's first word.
function draftStart() {
  const D = DRAFT;
  D.cls0 = players.map((p) => p.cls);
  D.hover = players.map(() => -1); D.lock = players.map(() => -1);
  D.fx = 0;
  D.role = players.map(() => -1);
  heroSearchClear();
  if (NET.isClient) { D.phase = 'wait'; return; }
  D.role = draftSeatRoles();
  draftPickPhase();
}
function draftStop() { DRAFT.phase = 'off'; }
function draftPickPhase() {
  const D = DRAFT;
  D.phase = 'pick'; D.t = draftPickT(); D.fx = 0.5;
  heroSearchClear();
  D.lock = players.map(() => -1);
  D.hover = players.map(() => -1); // a person starts on none: only a lock is theirs, the clock running out picks at random
  for (const p of players) if (p.active && !isHuman(p)) { const k = draftBotPick(p); D.lock[p.id] = D.hover[p.id] = k; }
  draftShow(D.hover[localId]);
  SFX.place();
  draftSend();
}
// the clock reaches its last COUNT_T (or every seat has locked): a seat that
// never locked gets a hero at random; every hero turns on, and the count begins
function draftReveal() {
  const D = DRAFT;
  for (const p of players) if (p.active && D.lock[p.id] < 0) D.lock[p.id] = D.hover[p.id] = draftRandom();
  D.phase = 'done';
  for (const p of players) if (p.active) { setClass(p, D.lock[p.id]); p.position = D.role[p.id]; } // the position goes into the match: a bot plays it (aiPosJob, js/ai/ai-farm.js)
  draftSend();
  netHostRoster();
  draftCount();
}
// the reveal's count on this screen: the rival frames turn one a tick (lobbyRevealed)
function draftCount() {
  const m = state.menu;
  m.csel = player.cls;
  PROFILE.setHero(CLASSES[player.cls].name); // the next match's draft opens on it
  m.countT = COUNT_T; m.countN = COUNT_T;
  m.lockFx = LOCK_FX_T;
  SFX.place();
}
function draftUpdate(dt) {
  const D = DRAFT, s = state.menu.screen;
  if (D.phase !== 'off' && s !== 'lobby' && !popOpen()) { draftStop(); return; } // the screen left: so did the draft
  D.fx = Math.max(0, D.fx - dt);
  if (!draftOpen()) return;
  D.t = Math.max(0, D.t - dt);
  if (!NET.isClient && D.t <= COUNT_T) draftReveal();
}
// every seat has locked: the clock jumps to its last COUNT_T, the reveal
function draftCheck() {
  const D = DRAFT;
  if (players.every((p) => !p.active || D.lock[p.id] >= 0)) draftReveal();
}
// the host's hand on a seat's press: 'hover' points, 'lock' confirms,
// 'role' moves the seat to position h, 'skin' wears look id on hero h,
function draftAct(slot, k, h, id) {
  const D = DRAFT, p = players[slot];
  if (NET.isClient || !p) return false;
  if (k === 'skin') return draftWearSkin(p, h, id);
  if (!draftOpen()) return false;
  if (k === 'role') return draftSwapRole(slot, h);
  if (D.lock[slot] >= 0) return false;
  if (!(h >= 0 && h < CLASSES.length)) return false;
  if (k === 'lock') {
    if (!draftCanLock(p, h)) { draftSend(); return false; } // a person was first: the guest's own copy of its lock is put right
    D.lock[slot] = h;
    if (isHuman(p)) draftYield(p, h);
  }
  D.hover[slot] = h;
  draftSend();
  draftCheck();
  return true;
}

// ------------------------------------------------------------ draft wire
// The host's copy to each guest, cut to what that guest's side may see: every
// lock (first come, first served shows on every screen), and what a seat only
// points at for its own side. Sent on every change; a guest's clock runs on
// between them.
function draftMsg(team) {
  const D = DRAFT, open = D.phase === 'done';
  const seen = (i) => open || players[i].team === team;
  return { t: 'draft', ph: D.phase, tl: isFinite(D.t) ? D.t : -1, // tl -1: an untimed pick (draftPickT)
    role: D.role.map((r, i) => players[i].team === team ? r : -1),
    hover: D.hover.map((h, i) => seen(i) ? h : -1),
    lock: D.lock.slice() };
}
function draftSend() {
  if (NET.role !== 'host' || !NET.peers.size) return;
  for (const [peer, pr] of NET.peers) NET.transport.send(peer, draftMsg(players[pr.slot].team));
}
function draftIn(msg) {
  const D = DRAFT, was = D.phase;
  D.phase = String(msg.ph); D.t = msg.tl < 0 ? Infinity : +msg.tl || 0;
  D.hover = msg.hover || []; D.lock = msg.lock || []; D.role = msg.role || [];
  if (D.phase === was) return;
  if (D.phase === 'pick') { D.fx = 0.5; SFX.place(); heroSearchClear(); draftShow(D.hover[localId]); }
  if (D.phase === 'done') { setClass(player, D.lock[localId]); draftCount(); }
}
// what this screen's own player points at, on the stage (its body, the hero pop-up) - picks only
function draftShow(h) {
  const m = state.menu;
  if (!(h >= 0 && h < CLASSES.length) || DRAFT.phase !== 'pick') return;
  if (player.cls !== h) { setClass(player, h); m.cswapT = 0; }
  m.csel = h;
}
// this screen's presses: point at a hero (the row, the keys), confirm it (LOCK IN)
function draftPoint(h) {
  const D = DRAFT;
  if (!draftOpen() || D.lock[localId] >= 0 || !CLASSES[h]) { SFX.deny(); return; }
  if (D.hover[localId] === h) return;
  D.hover[localId] = h;
  draftShow(h);
  if (NET.isClient) NET.transport.send('host', { t: 'draft', k: 'hover', h });
  else draftAct(localId, 'hover', h);
  SFX.pickup();
}
function draftConfirm() {
  const D = DRAFT, h = D.hover[localId];
  if (!draftOpen() || D.lock[localId] >= 0 || h < 0 || !draftCanLock(player, h)) { SFX.deny(); return; }
  state.menu.lockFx = LOCK_FX_T;
  state.menu.pressT = 0.12;
  SFX.place();
  if (NET.isClient) { D.lock[localId] = h; NET.transport.send('host', { t: 'draft', k: 'lock', h }); }
  else draftAct(localId, 'lock', h);
}
// this screen's own position: a bot holding the one asked for trades; the
// profile keeps it as the one to ask for next draft
function draftRole(r) {
  const D = DRAFT, q = players.find((o) => o.team === player.team && o !== player && D.role[o.id] === r);
  if (!draftOpen() || D.role[localId] === r || (q && isHuman(q))) { SFX.deny(); return; }
  PROFILE.setPos(r);
  if (NET.isClient) { D.role[localId] = r; NET.transport.send('host', { t: 'draft', k: 'role', h: r }); }
  else draftAct(localId, 'role', r);
  SFX.pickup();
}
// the next position along from this screen's own that no person on its side holds
function draftNextRole() {
  const D = DRAFT, cur = Math.max(0, D.role[localId]);
  for (let d = 1; d < POSITIONS.length; d++) {
    const r = (cur + d) % POSITIONS.length, q = players.find((o) => o.team === player.team && o !== player && D.role[o.id] === r);
    if (!q || !isHuman(q)) return r;
  }
  return -1;
}
// the look this screen's player wears on hero h (null: the hero's own), from
// the skin strip under the showcase; the host takes a seat's the same way
function draftWearSkin(p, h, id) {
  const c = CLASSES[h];
  if (!c) return false;
  const m = Object.assign({}, p.skins);
  if (id) m[c.id] = String(id); else delete m[c.id];
  p.skins = cleanHeroSkins(m);
  return true;
}
function draftSkin(h, id) {
  const c = CLASSES[h];
  if (!c) return;
  PROFILE.wear(c.id, id || null);
  draftWearSkin(player, h, id);
  if (NET.isClient) NET.transport.send('host', { t: 'draft', k: 'skin', h, id: id || '' });
  SFX.pickup();
}
// the keys' step through the heroes still free to lock
function draftStep(d) {
  const n = CLASSES.length, D = DRAFT;
  let h = D.hover[localId] >= 0 ? D.hover[localId] : 0;
  for (let k = 0; k < n; k++) { h = ((h + d) % n + n) % n; if (draftCanLock(player, h)) { draftPoint(h); return; } }
}

// ------------------------------------------------------------ draft pixels
// What the champ select's look (js/ui/select.js) and the grid (js/ui/heroes.js)
// share from the draft: a hero's head and the word on the confirm plate.
// A hero's head and shoulders, the square every face cell draws (HERO_FACE on a
// side at 1x): { img, x, y, w } the source square - its standing front in a look
// (`skinId`, else the free one), ten of its 16 px wide and tall around the head,
// drawn at 2x.
const HERO_HEAD16 = { x: 3, y: 0, w: 10 };
function heroHead(h, team, skinId) {
  return { img: SPRITES.champLook(h, team, skinId || null).down[0], x: HERO_HEAD16.x, y: HERO_HEAD16.y, w: HERO_HEAD16.w };
}
function draftFace(h, x, y, s, dim) {
  const S = HERO_FACE, f = heroHead(h, skin(player.team), null);
  ctx.drawImage(f.img, f.x, f.y, f.w, f.w, x, y, S * s, S * s);
  if (dim) { const a = ctx.globalAlpha; ctx.globalAlpha = a * dim; ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y, S * s, S * s); ctx.globalAlpha = a; }
}
// The confirm plate's word: LOCK IN while the pick is open, live
// while this screen has a confirm to make (slate once made, or with nothing
// pointed at)
function draftWord() {
  const D = DRAFT;
  if (!draftOpen()) return null;
  const live = D.lock[localId] < 0 && D.hover[localId] >= 0 && draftCanLock(player, D.hover[localId]);
  return { w: 'LOCK IN', live };
}
