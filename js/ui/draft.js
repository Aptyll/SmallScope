'use strict';
// ------------------------------------------------------------ draft rules
// The hero select's DRAFT (the lobby, js/ui/menu.js), the way every party
// reaches the eagle: a BAN phase, then a BLIND PICK where all ten seats pick
// at once, then the reveal count (COUNT_T) to the drop. The host keeps the
// draft and every screen draws its copy (DRAFT); a guest points and confirms
// through the host (`draft` messages, js/net/net.js) like any other press.
//
// BANS: one hero per team while the roster is under DRAFT_BAN_MANY, one per
// seat from then on, and never so many that fewer than DRAFT_KEEP stay
// pickable (draftBansPerTeam: none at all on a roster that small). Every
// seat points at a hero and BAN confirms it; the team's bans are its most
// pointed-at heroes, the people's before the bots' (draftTeamBans), so a bot
// never outvotes a person. The rivals' bans stay hidden until the phase ends.
// PICK: everyone at once, blind: you see your own side's points and locks,
// and of the rivals only that a seat has locked. A hero a teammate locked is
// out for you until your side has locked every hero there is (then repeats
// come back); the rivals may take the same hero as you. Bots act the moment a
// phase opens and give a hero up when a person on their side locks it
// (draftYield). The clock running out confirms what each seat points at, or
// picks for it the way a bot would. The draft is not sim state: it lives and
// ends on the title, and its result is the class each player flies out with.
const DRAFT_BAN_T = 15;        // s: the ban phase
const DRAFT_PICK_T = 30;       // s: the blind pick, everyone at once (ends early once every seat has locked)
const DRAFT_BAN_MANY = 15;     // heroes at which every seat bans one; under it each team bans one
const DRAFT_KEEP = 3;          // heroes the bans always leave pickable
const DRAFT_RANGED = 2;        // a bot's side wants about this many heroes at range
const DRAFT = {
  phase: 'off',                // 'off' | 'wait' (a guest before the host's first word) | 'ban' | 'pick' | 'done'
  t: 0,                        // s left in the phase
  nBan: 0,                     // bans per team this draft
  cls0: [],                    // per seat: the hero it came in on (a person's own main)
  hover: [],                   // per seat: the hero it points at, -1 none (a guest sees -1 for a hidden rival)
  lock: [],                    // per seat: the hero it confirmed, -1 none, -2 a rival's that is hidden
  lead: [[], []],              // per team: its bans as the votes stand (the rivals' hidden until the phase ends)
  banned: [],                  // the heroes out of the pick
  role: [],                    // per seat: its POSITIONS index (your side's; a rival's is -1 on a guest)
  fx: 0,                       // s: the flash as a phase turns
};
function draftOpen() { return DRAFT.phase === 'ban' || DRAFT.phase === 'pick'; }
function draftHiding() { return draftOpen() || DRAFT.phase === 'wait'; }
function heroRanged(h) { return !!CLASSES[h].attack.shot; }
function draftBansPerTeam() {
  const n = CLASSES.length;
  let b = n >= DRAFT_BAN_MANY ? MAX_PLAYERS >> 1 : 1;
  while (b > 0 && n - 2 * b < DRAFT_KEEP) b--;
  return b;
}
function draftMates(p) { return players.filter((q) => q.team === p.team && q !== p); }
// the hero a seat stands behind: its lock, else what it points at
function draftWant(i) { return DRAFT.lock[i] >= 0 ? DRAFT.lock[i] : DRAFT.hover[i]; }
// every hero still in the pick is locked by a person on p's side: repeats are back
// (a bot's hero is never in a person's way: it gives it up)
function draftSideFull(p) {
  const mates = players.filter((q) => q.team === p.team && isHuman(q));
  for (let h = 0; h < CLASSES.length; h++) if (!DRAFT.banned.includes(h) && !mates.some((q) => DRAFT.lock[q.id] === h)) return false;
  return true;
}
// may p lock hero h: not banned, and no PERSON on its side holds it (a bot gives it up)
function draftCanLock(p, h) {
  if (!(h >= 0 && h < CLASSES.length) || DRAFT.banned.includes(h)) return false;
  return !draftMates(p).some((q) => isHuman(q) && DRAFT.lock[q.id] === h) || draftSideFull(p);
}
// the team's bans as its votes stand: the people's most pointed-at first, then the bots'
function draftTeamBans(team) {
  const out = [];
  for (const people of [true, false]) {
    const votes = new Map();
    for (const q of players) if (q.team === team && isHuman(q) === people) {
      const h = draftWant(q.id);
      if (h >= 0 && !out.includes(h)) votes.set(h, (votes.get(h) || 0) + 1);
    }
    const order = [...votes.keys()].sort((a, b) => votes.get(b) - votes.get(a)); // a tie keeps seat order
    for (const h of order) if (out.length < DRAFT.nBan) out.push(h);
  }
  return out;
}

// ------------------------------------------------------------ draft roles
// League's five POSITIONS (js/sim/player.js), one per seat on each side,
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
    const side = players.filter((q) => q.team === team), free = POSITIONS.map((_, i) => i);
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
// A bot bans what the rival people came in on (their mains), never a hero a
// person on its own side came in on; with no people across, a free hero at random.
function draftBotBan(p) {
  const mine = new Set(players.filter((q) => q.team === p.team && isHuman(q)).map((q) => DRAFT.cls0[q.id]));
  const votes = CLASSES.map(() => 0);
  for (const q of players) if (q.team !== p.team && isHuman(q)) votes[DRAFT.cls0[q.id]]++;
  let best = [], top = -1;
  for (let h = 0; h < CLASSES.length; h++) if (!mine.has(h)) {
    if (votes[h] > top) { top = votes[h]; best = [h]; } else if (votes[h] === top) best.push(h);
  }
  return best.length ? best[Math.floor(Math.random() * best.length)] : -1;
}
// A bot picks a hero its side does not hold yet - a person's point counts as
// theirs - leaning to the shape the side lacks (about DRAFT_RANGED at range)
function draftBotPick(p) {
  const mates = draftMates(p);
  const held = (q) => DRAFT.lock[q.id] >= 0 ? DRAFT.lock[q.id] : isHuman(q) ? DRAFT.hover[q.id] : -1;
  const ranged = mates.filter((q) => held(q) >= 0 && heroRanged(held(q))).length;
  const want = ranged < DRAFT_RANGED;
  let best = [], low = Infinity;
  for (let h = 0; h < CLASSES.length; h++) {
    if (DRAFT.banned.includes(h)) continue;
    const s = mates.filter((q) => held(q) === h).length * 4 + (heroRanged(h) === want ? 0 : 1);
    if (s < low) { low = s; best = [h]; } else if (s === low) best.push(h);
  }
  return best.length ? best[Math.floor(Math.random() * best.length)] : 0;
}
// a person on p's side locked h: a bot of that side holding it picks again
function draftYield(p, h) {
  for (const q of draftMates(p)) if (!isHuman(q) && DRAFT.lock[q.id] === h) {
    DRAFT.lock[q.id] = -1; DRAFT.hover[q.id] = -1;
    const k = draftBotPick(q);
    DRAFT.lock[q.id] = DRAFT.hover[q.id] = k;
  }
}

// ------------------------------------------------------------ draft flow
// The host's: beginLobby opens it, updateTitle runs its clock, and the end of
// the pick turns every seat's hero on and starts the count. A guest waits for
// the host's first word.
function draftStart() {
  const D = DRAFT;
  D.cls0 = players.map((p) => p.cls);
  D.hover = players.map(() => -1); D.lock = players.map(() => -1);
  D.lead = [[], []]; D.banned = []; D.fx = 0;
  D.nBan = draftBansPerTeam();
  D.role = players.map(() => -1);
  if (NET.isClient) { D.phase = 'wait'; return; }
  D.role = draftSeatRoles();
  if (D.nBan > 0) {
    D.phase = 'ban'; D.t = DRAFT_BAN_T;
    for (const p of players) if (!isHuman(p)) D.lock[p.id] = D.hover[p.id] = draftBotBan(p);
    draftLeads();
    draftSend();
  } else draftPickPhase();
}
function draftStop() { DRAFT.phase = 'off'; }
function draftLeads() { DRAFT.lead = [draftTeamBans(0), draftTeamBans(1)]; }
function draftPickPhase() {
  const D = DRAFT;
  if (D.phase === 'ban') { draftLeads(); D.banned = [...new Set(D.lead[0].concat(D.lead[1]))]; }
  D.phase = 'pick'; D.t = DRAFT_PICK_T; D.fx = 0.5;
  D.lock = players.map(() => -1);
  D.hover = players.map((p) => isHuman(p) && !D.banned.includes(D.cls0[p.id]) ? D.cls0[p.id] : -1); // a person starts on their own
  for (const p of players) if (!isHuman(p)) { const k = draftBotPick(p); D.lock[p.id] = D.hover[p.id] = k; }
  draftShow(D.hover[localId]);
  SFX.place();
  draftSend();
}
// the clock runs out (or every seat has locked): each seat takes what it
// points at (a bot of its side giving it up), or a bot's choice; every hero turns on, and the count begins
function draftReveal() {
  const D = DRAFT;
  for (const p of players) if (D.lock[p.id] < 0) {
    const h = D.hover[p.id];
    const own = isHuman(p) && draftCanLock(p, h);
    D.lock[p.id] = D.hover[p.id] = own ? h : draftBotPick(p);
    if (own) draftYield(p, h);
  }
  D.phase = 'done';
  for (const p of players) { setClass(p, D.lock[p.id]); p.position = D.role[p.id]; } // the position goes into the match: a bot plays it (aiPosJob, js/ai/ai-farm.js)
  draftSend();
  netHostRoster();
  draftCount();
}
// the reveal's count on this screen: the rival frames turn one a tick (lobbyRevealed)
function draftCount() {
  const m = state.menu;
  m.csel = player.cls;
  PROFILE.setHero(player.cls); // the next match's draft opens on it
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
  if (NET.isClient || D.t > 0) return;
  if (D.phase === 'ban') draftPickPhase(); else draftReveal();
}
// every seat that must act has: the phase ends now (a ban: every person confirmed)
function draftCheck() {
  const D = DRAFT;
  if (!players.every((p) => D.lock[p.id] >= 0 || (D.phase === 'ban' && !isHuman(p)))) return;
  if (D.phase === 'ban') draftPickPhase(); else draftReveal();
}
// the host's hand on a seat's press: 'hover' points, 'lock' confirms (a ban,
// or the pick), 'role' moves the seat to position h, 'skin' wears look id on hero h
function draftAct(slot, k, h, id) {
  const D = DRAFT, p = players[slot];
  if (NET.isClient || !p) return false;
  if (k === 'skin') return draftWearSkin(p, h, id);
  if (!draftOpen()) return false;
  if (k === 'role') return draftSwapRole(slot, h);
  if (D.lock[slot] >= 0) return false;
  if (!(h >= 0 && h < CLASSES.length) || D.banned.includes(h)) return false;
  if (k === 'lock') {
    if (D.phase === 'pick' && !draftCanLock(p, h)) return false;
    D.lock[slot] = h;
    if (D.phase === 'pick' && isHuman(p)) draftYield(p, h);
  }
  D.hover[slot] = h;
  if (D.phase === 'ban') draftLeads();
  draftSend();
  draftCheck();
  return true;
}

// ------------------------------------------------------------ draft wire
// The host's copy to each guest, cut to what that guest's side may see: its
// own side whole, of the rivals only who has confirmed (-2), and their bans
// once the ban phase is over. Sent on every change; a guest's clock runs on
// between them.
function draftMsg(team) {
  const D = DRAFT, open = D.phase === 'done';
  const seen = (i) => open || players[i].team === team;
  return { t: 'draft', ph: D.phase, tl: D.t, n: D.nBan, banned: D.banned,
    role: D.role.map((r, i) => players[i].team === team ? r : -1),
    hover: D.hover.map((h, i) => seen(i) ? h : -1),
    lock: D.lock.map((h, i) => seen(i) ? h : h >= 0 ? -2 : -1),
    lead: [0, 1].map((t) => t === team || D.phase !== 'ban' ? D.lead[t] : []) };
}
function draftSend() {
  if (NET.role !== 'host' || !NET.peers.size) return;
  for (const [peer, pr] of NET.peers) NET.transport.send(peer, draftMsg(players[pr.slot].team));
}
function draftIn(msg) {
  const D = DRAFT, was = D.phase;
  D.phase = String(msg.ph); D.t = +msg.tl || 0; D.nBan = msg.n | 0;
  D.banned = msg.banned || []; D.hover = msg.hover || []; D.lock = msg.lock || []; D.lead = msg.lead || [[], []]; D.role = msg.role || [];
  if (D.phase === was) return;
  if (D.phase === 'pick') { D.fx = 0.5; SFX.place(); draftShow(D.hover[localId]); }
  if (D.phase === 'done') { setClass(player, D.lock[localId]); draftCount(); }
}
// what this screen's own player points at, on the stage (its body, the hero pop-up) - picks only
function draftShow(h) {
  const m = state.menu;
  if (!(h >= 0 && h < CLASSES.length) || DRAFT.phase !== 'pick') return;
  if (player.cls !== h) { setClass(player, h); m.cswapT = 0; }
  m.csel = h;
}
// this screen's presses: point at a hero (the row, the keys), confirm it (BAN / LOCK IN)
function draftPoint(h) {
  const D = DRAFT;
  if (!draftOpen() || D.lock[localId] >= 0 || D.banned.includes(h) || !CLASSES[h]) { SFX.deny(); return; }
  if (D.hover[localId] === h) return;
  D.hover[localId] = h;
  draftShow(h);
  if (NET.isClient) NET.transport.send('host', { t: 'draft', k: 'hover', h });
  else draftAct(localId, 'hover', h);
  SFX.pickup();
}
function draftConfirm() {
  const D = DRAFT, h = D.hover[localId];
  if (!draftOpen() || D.lock[localId] >= 0 || h < 0 || (D.phase === 'pick' && !draftCanLock(player, h))) { SFX.deny(); return; }
  if (D.phase === 'pick') state.menu.lockFx = LOCK_FX_T;
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
// the skin strip under the splash; the host takes a seat's the same way
function draftWearSkin(p, h, id) {
  const c = CLASSES[h];
  if (!c || !c.skinSlot) return false;
  const m = Object.assign({}, p.skins);
  if (id) m[c.skinSlot] = String(id); else delete m[c.skinSlot];
  p.skins = cleanHeroSkins(m);
  return true;
}
function draftSkin(h, id) {
  const c = CLASSES[h];
  if (!c || !c.skinSlot) return;
  PROFILE.wear(c.skinSlot, id || null);
  draftWearSkin(player, h, id);
  if (NET.isClient) NET.transport.send('host', { t: 'draft', k: 'skin', h, id: id || '' });
  SFX.pickup();
}
// the keys' step through the heroes still in the pick
function draftStep(d) {
  const n = CLASSES.length, D = DRAFT;
  let h = D.hover[localId] >= 0 ? D.hover[localId] : 0;
  for (let k = 0; k < n; k++) { h = ((h + d) % n + n) % n; if (!D.banned.includes(h)) { draftPoint(h); return; } }
}

// ------------------------------------------------------------ draft pixels
// What the champ select's look (js/ui/select.js) and the grid (js/ui/heroes.js)
// share from the draft: a hero's head, the ban's red stroke, and the word on
// the confirm plate.
const DRAFT_RED = '#e04848';
// A hero's head and shoulders, the square every face cell draws (S = HERO_CROP.s
// on a side at 1x): { img, x, y, w } the source square. A hero with looks of its
// own shows its standing front in that look (`skinId`, else the free one), ten
// of its 16 px wide and tall around the head at twice the scale of the 48 px
// model's crop, so both fill the same cell at whole-pixel scales.
const HERO_HEAD16 = { x: 3, y: 0, w: 10 };
function heroHead(h, look, team, skinId) {
  const c = CLASSES[h];
  if (c && c.skins) return { img: SPRITES.champLook(h, look, team, skinId || null).down[0], x: HERO_HEAD16.x, y: HERO_HEAD16.y, w: HERO_HEAD16.w };
  return { img: SPRITES.portrait(h, look, team), x: HERO_CROP.x, y: HERO_CROP.y, w: HERO_CROP.s };
}
function draftFace(h, x, y, s, dim) {
  const c = CLASSES[h], S = HERO_CROP.s, f = heroHead(h, c.look, skin(player.team), null);
  ctx.drawImage(f.img, f.x, f.y, f.w, f.w, x, y, S * s, S * s);
  if (dim) { const a = ctx.globalAlpha; ctx.globalAlpha = a * dim; ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y, S * s, S * s); ctx.globalAlpha = a; }
}
function draftSlash(x, y, n) { ctx.fillStyle = DRAFT_RED; for (let i = 0; i < n; i++) ctx.fillRect(x + n - 1 - i, y + i, 2, 1); }
// The confirm plate's word: BAN or LOCK IN while the draft is open, live
// while this screen has a confirm to make (slate once made, or with nothing
// pointed at)
function draftWord() {
  const D = DRAFT;
  if (!draftOpen()) return null;
  const live = D.lock[localId] < 0 && D.hover[localId] >= 0 && (D.phase === 'ban' || draftCanLock(player, D.hover[localId]));
  return { w: D.phase === 'ban' ? 'BAN' : 'LOCK IN', live };
}
