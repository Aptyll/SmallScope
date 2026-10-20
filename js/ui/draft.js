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
// A bot picks the hero its side has least of - a person's point counts as
// theirs - leaning to the shape the side lacks (about DRAFT_RANGED at range)
function draftBotPick(p) {
  const mates = draftMates(p);
  const held = (q) => DRAFT.lock[q.id] >= 0 ? DRAFT.lock[q.id] : isHuman(q) ? DRAFT.hover[q.id] : -1;
  const ranged = mates.filter((q) => held(q) >= 0 && heroRanged(held(q))).length;
  const want = ranged < DRAFT_RANGED;
  let best = [], low = Infinity;
  for (let h = 0; h < CLASSES.length; h++) {
    if (DRAFT.banned.includes(h)) continue;
    const s = mates.filter((q) => held(q) === h).length * 2 + (heroRanged(h) === want ? 0 : 1);
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
  if (NET.isClient) { D.phase = 'wait'; return; }
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
  for (const p of players) setClass(p, D.lock[p.id]);
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
// the host's hand on a seat's press: 'hover' points, 'lock' confirms (a ban, or the pick)
function draftAct(slot, k, h) {
  const D = DRAFT, p = players[slot];
  if (NET.isClient || !p || !draftOpen() || D.lock[slot] >= 0) return false;
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
  D.banned = msg.banned || []; D.hover = msg.hover || []; D.lock = msg.lock || []; D.lead = msg.lead || [[], []];
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
// the keys' step through the heroes still in the pick
function draftStep(d) {
  const n = CLASSES.length, D = DRAFT;
  let h = D.hover[localId] >= 0 ? D.hover[localId] : 0;
  for (let k = 0; k < n; k++) { h = ((h + d) % n + n) % n; if (!D.banned.includes(h)) { draftPoint(h); return; } }
}

// ------------------------------------------------------------ draft pixels
// The top centre: the clock (gold while this screen still has to act) and
// the phase's word under it, each side's ban wells beside it - yours toward
// your panel - a vote standing as a dim face, a ban made as a face struck
// through in red.
const DRAFT_WELL = 22, DRAFT_WELL_G = 3, DRAFT_CLOCK_W = 30; // a ban well; the clock's half-width
const DRAFT_TOP = 46;          // the top band's height: the hero row starts under it
const DRAFT_RED = '#e04848';
const DRAFT_MUTE = '#3a4670';  // a word or a seat with nothing to do
function draftFace(h, x, y, s, dim) {
  const c = CLASSES[h], S = HERO_CROP.s;
  ctx.drawImage(SPRITES.portrait(h, c.look, skin(player.team)), HERO_CROP.x, HERO_CROP.y, S, S, x, y, S * s, S * s);
  if (dim) { const a = ctx.globalAlpha; ctx.globalAlpha = a * dim; ctx.fillStyle = '#0a0e23'; ctx.fillRect(x, y, S * s, S * s); ctx.globalAlpha = a; }
}
function draftSlash(x, y, n) { ctx.fillStyle = DRAFT_RED; for (let i = 0; i < n; i++) ctx.fillRect(x + n - 1 - i, y + i, 2, 1); }
function drawDraftTop(a) {
  const D = DRAFT, cx = VIEW_W >> 1, y = LOBBY_PAD + 2;
  if (D.phase === 'off' || D.phase === 'wait') return;
  ctx.globalAlpha = a;
  for (let t = 0; t < 2; t++) {
    const mine = t === player.team, n = D.nBan;
    if (!n) continue;
    const span = n * (DRAFT_WELL + DRAFT_WELL_G) - DRAFT_WELL_G;
    const x0 = mine ? cx - DRAFT_CLOCK_W - span : cx + DRAFT_CLOCK_W;
    ctx.fillStyle = TEAMS[skin(t)].mark; ctx.fillRect(x0, y - 3, span, 1);
    for (let k = 0; k < n; k++) {
      const r = { x: x0 + k * (DRAFT_WELL + DRAFT_WELL_G), y, w: DRAFT_WELL, h: DRAFT_WELL };
      drawWell(r, 0, false, false);
      const h = D.lead[t] ? D.lead[t][k] : undefined;
      if (h == null || !CLASSES[h]) continue;
      const made = D.phase !== 'ban';
      draftFace(h, r.x + 1, r.y + 1, 1, made ? 0.6 : 0.35);
      if (made) draftSlash(r.x + 1, r.y + 1, DRAFT_WELL - 2);
    }
  }
  if (!draftOpen()) return;
  const act = D.lock[localId] < 0, col = act ? '#ffd95c' : '#9fb6d8';
  const s = String(Math.ceil(D.t)), w = D.phase === 'ban' ? 'BAN' : 'PICK';
  drawPixelTextOutline(ctx, s, cx - (pixelTextWidth(s, 3) >> 1), y, col, 'rgba(8,12,28,0.9)', 3);
  drawPixelTextShadow(ctx, w, cx - (pixelTextWidth(w) >> 1), y + 26, col, '#0a0e23');
}
// The word at the foot: BAN or LOCK IN while this screen has a confirm to
// make, slate once it is made (or with nothing pointed at); gone at the count
function draftWord() {
  const D = DRAFT;
  if (!draftOpen()) return null;
  const live = D.lock[localId] < 0 && D.hover[localId] >= 0 && (D.phase === 'ban' || draftCanLock(player, D.hover[localId]));
  return { w: D.phase === 'ban' ? 'BAN' : 'LOCK IN', live };
}

// One roster frame, glued to its screen edge: the side's paint as a bar down
// that edge, the hero's body at 2x (1x in a short view) toward it, the name
// inward of the body and the hero's name under it. Yours wears the gold rim.
// Your side's frames show each seat's hero - faded while only pointed at,
// whole once locked; a rival's is face-down (a flat shade of the body it came
// in on) until the count turns it, and flashes white as it does. A seat that
// has confirmed (a ban or its pick) carries a gold pip.
function drawLobbyCard(r, mine, hidden, flash) {
  const p = r.p, side = skin(p.team), me = p === player, D = DRAFT;
  ctx.fillStyle = 'rgba(4,6,18,0.55)';
  ctx.fillRect(r.x, r.y + 2, r.w + 2, r.h);
  // in a room: a person's frame wears a brighter rim than a bot's, the host's
  // a crown, and one that just came or went flashes white (cardFx)
  const inRoom = NET.role !== 'solo', person = inRoom && isHuman(p);
  const fx = inRoom && state.menu.cardFx && state.menu.cardFx[p.id] > 0;
  ctx.fillStyle = flash || fx ? '#f4f7ff' : me ? '#c89a3c' : person ? '#6d7ea6' : '#2c3560';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = me ? '#1a2142' : '#0f1632';
  ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  ctx.fillStyle = TEAMS[side].mark;
  ctx.fillRect(mine ? r.x : r.x + r.w - 3, r.y, 3, r.h);
  const s = r.h >= 38 ? 2 : 1, bw = 16 * s;
  const bx = mine ? r.x + 8 : r.x + r.w - 8 - bw, by = r.y + ((r.h - bw) >> 1);
  if (inRoom && p.id === (NET.isClient ? NET.hostSlot : localId)) { // the crown
    ctx.fillStyle = '#ffd95c';
    const cxx = bx + (bw >> 1) - 2;
    ctx.fillRect(cxx, by - 3, 1, 1); ctx.fillRect(cxx + 2, by - 3, 1, 1); ctx.fillRect(cxx + 4, by - 3, 1, 1);
    ctx.fillRect(cxx, by - 2, 5, 1);
  }
  if (draftOpen() && D.lock[p.id] !== -1) { // confirmed: the gold pip in the inner corner
    ctx.fillStyle = '#ffd95c';
    ctx.fillRect(mine ? r.x + r.w - 6 : r.x + 3, r.y + 3, 3, 3);
  }
  // the hero this frame shows: a pick in play on your side, else the body it wears
  const h = draftOpen() && D.phase === 'pick' && !hidden ? draftWant(p.id) : -1;
  const firm = h < 0 || D.lock[p.id] >= 0;
  const spr = h >= 0 ? SPRITES.champLook(h, CLASSES[h].look, side, heroSkinOf({ cls: h, skins: p.skins })).down[0]
    : SPRITES.champLook(p.cls, p.look, side, heroSkinOf(p)).down[0];
  if (hidden) {
    sctx.clearRect(0, 0, 16, 16);
    sctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(spr, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = '#35426e';
    sctx.fillRect(0, 0, 16, 16);
    sctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0, 16, 16, bx, by, bw, bw);
  } else if (h >= 0 || D.phase !== 'pick') {
    const a = ctx.globalAlpha;
    if (!firm) ctx.globalAlpha = a * 0.45;
    ctx.drawImage(spr, bx, by, bw, bw);
    ctx.globalAlpha = a;
  }
  const hero = hidden ? '' : h >= 0 ? CLASSES[h].name : D.phase === 'done' ? CLASSES[p.cls].name : '';
  const nm = p.name, col = me ? '#ffd95c' : hidden ? '#6d7ea6' : TEAMS[side].mark;
  const tx = (t) => mine ? bx + bw + 5 : bx - 5 - pixelTextWidth(t);
  const cy = r.y + ((r.h - 5) >> 1);
  drawPixelTextShadow(ctx, nm, tx(nm), hero ? cy - 5 : cy, col, '#0a0e23');
  if (hero) drawPixelTextShadow(ctx, hero, tx(hero), cy + 5, firm ? '#c8d4ee' : '#5a6690', '#0a0e23');
}
// The two panels' frames. A rival's stays face-down through the draft and
// turns face-up when lobbyRevealed() passes it. slide is the entrance: each
// panel rides in from its own edge.
function drawLobbyRosters(now, a, slide) {
  const m = state.menu;
  const { cards } = lobbyLayout();
  const shown = draftHiding() ? 0 : lobbyRevealed();
  ctx.globalAlpha = a;
  for (let mine = 1; mine >= 0; mine--) {
    const col = cards[mine];
    const dx = mine ? -slide : slide;
    for (let k = 0; k < col.length; k++) {
      const r = col[k];
      const hidden = !mine && k >= shown;
      const flash = !mine && !hidden && m.countT > 0 && (COUNT_T - k) - m.countT < 0.15;
      drawLobbyCard({ x: r.x + dx, y: r.y, w: r.w, h: r.h, p: r.p }, mine, hidden, flash);
    }
  }
}
