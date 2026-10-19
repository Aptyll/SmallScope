// ------------------------------------------------------------ party lobby
// The screen every mode opens (QUICKPLAY, RANKED, js/ui/menu.js), League's
// party lobby read in the post-game page's Graphite (js/ui/lobby.js): flat,
// opaque, the mode's name for a head, the actions plain words at the foot
// (docs/pvp-architecture.md has the wire).
//
// A party IS a room: the screen hosts one the moment it opens (netHost, js/net/net.js),
// on the relay or, under the wrapper with Steam asked for (netSteam), as a
// Steam lobby, and it works the same with neither there - a party of one.
// Its five seats are YOUR side's, in one column: you (the gold rim), the
// friends who came in (a READY tick, three ping bars) and the empty ones,
// each a dotted well with a gold + that invites - Steam's friends overlay
// under the wrapper, the code onto the clipboard otherwise. The room's CODE
// sits top-right in gold (a click copies it), INVITE beside it on Steam;
// alone in your party, a CODE box under it joins a friend's party by the
// four letters they read out (click it and type, or paste anywhere) - the
// code finds its room off the relay's list or Steam's lobbies (partySeek).
// Chat runs under the seats (js/ui/roomtalk.js). A guest's READY ticks its
// name; the leader's FIND MATCH stays dim until every friend has, then fills
// every empty seat on both sides with bots and takes the whole party to the
// hero select (netPhase 'pick', the lobby in js/ui/menu.js) and from there
// to the drop. The rival side is never shown here: it is all bots until
// matchmaking pairs parties. After the match, LOBBY brings the party back to
// this screen on a fresh valley (the rematch, below).
const PARTY_MODES = { quick: 'QUICKPLAY', ranked: 'RANKED' };
const RM_CODE_N = 4;                   // letters in a code (makeCode, app/server.js; steamCode, js/net/transport-steam.js)
const RM_CODE_W = 52, RM_CODE_H = 16;  // the CODE box
const RS_TOP = 58, RS_H = 34, RS_GAP = 4, RS_W = 260; // the seats: first one's top, a seat's height, between seats, the column's width
const RS_TOOL = 24;                    // px at a seat's far end that is the leader's hand (show a friend out)
const SEEK_T = 6;                      // s a typed code is looked for on the list before it rattles
// RANKED: a rating per profile (PROFILE.rank, js/app/profile.js), RANK_STEP
// up for a win and down for a loss, and the bots' level read off the party's
// average rating, one AI_LEVELS step per RANK_BAND around the start
const RANK_STEP = 25, RANK_BAND = 200;

let roomsFeed = null; // the relay's list socket (or Steam's lobby poll) while a code is being looked for
function roomsFeedClose() { if (roomsFeed) { roomsFeed.close(); roomsFeed = null; } }
function roomsFeedOpen() {
  if (roomsFeed) return;
  const m = state.menu;
  m.rooms = []; m.roomsOk = false;
  roomsFeed = (netSteam() ? steamRooms : (cb) => wsRooms(netRelay(), cb))((rooms, ok) => { m.rooms = rooms; m.roomsOk = ok; });
}
function roomOk(r) { return r.data && r.data.patch === PATCH_TXT; }

// a mode picked on the title: this screen's own party, hosted at once
function beginParty(mode) {
  if (NET.role === 'client') netLeave();
  if (NET.role === 'solo') netHost();
  NET.mode = mode;
  beginRoom();
}
// back to the title: the party closes (a guest walks out of someone else's)
function leaveRoom() {
  roomsFeedClose();
  netLeave();
  NET.mode = null;
  const m = state.menu;
  m.screen = 'menu'; m.seek = null; m.joining = false;
  SFX.pickup();
  SFX.music.play('intro');
}
// the leader's seats while the party waits: every seat on its side that is
// not a person stands empty for a friend, every rival seat is a bot
function partySeats() {
  if (NET.role !== 'host' || !seatsOpen()) return;
  for (const p of players) if (!isHuman(p)) p.control = p.team === player.team ? 'none' : 'ai';
  netHostRoster(); netHostRoom();
}
function partyName() { return PARTY_MODES[NET.mode] || PARTY_MODES.quick; }
function partySize() { return roomSide(player.team).filter(isHuman).length; }
// RANKED's bots: a level off the party's average rating, a band either side of the start
function rankLevel() {
  const rs = players.filter((p) => isHuman(p) && p.team === player.team).map((p) => NET.ranks[p.id] || PROFILE.RANK_START);
  const avg = rs.reduce((s, r) => s + r, 0) / Math.max(1, rs.length);
  return Math.max(0, Math.min(AI_LEVELS.length - 1, 1 + Math.floor((avg - PROFILE.RANK_START) / RANK_BAND + 0.5)));
}
// a ranked match's ending on this screen: the profile's rating moves (endMatch, js/sim/player.js)
function rankResult(won) { if (NET.mode === 'ranked') PROFILE.addRank(won ? RANK_STEP : -RANK_STEP); }

// FIND MATCH: every friend READY, then bots into every empty seat and the
// party on to the hero select. RANKED pins the bots' level (NET.botLv,
// read by aiProfile, js/ai/ai-skill.js); QUICKPLAY leaves it the leader's.
function partyFind() {
  const m = state.menu;
  if (NET.role !== 'host' || !seatsOpen()) return;
  if (!roomAllReady()) { // the seats it waits on flash, and nothing starts
    for (const p of players) if (p.control === 'remote' && !NET.ready.has(p.id)) m.cardFx[p.id] = 0.6;
    SFX.deny();
    return;
  }
  for (const p of players) if (!isHuman(p)) p.control = 'ai';
  NET.botLv = NET.mode === 'ranked' ? rankLevel() : null;
  m.pressT = 0.12;
  netHostRoster(); netHostRoom();
  netPhase('pick');
  beginLobby();
}

// ---- joining a friend's party by its code -------------------------------
// The code is looked up on the list (the relay's rooms, or Steam's lobbies,
// whose data carries the code) for its seed and shape, which a join must
// match: joinRoom reloads onto them when this page grew another world.
function partySeek(code, wait) {
  const m = state.menu;
  if (code === roomCode()) { m.codeShake = NAME_SHAKE_T; SFX.deny(); return; } // your own party
  m.seek = { code, t: wait || SEEK_T };
  roomsFeedOpen();
}
function seekMatch(r, code) { return roomOk(r) && (String(r.room).toUpperCase() === code || (r.data && String(r.data.code || '').toUpperCase() === code)); }
function joinRoom(r) {
  const m = state.menu;
  m.seek = null;
  roomsFeedClose();
  const seed = r.data && +r.data.seed, map = (r.data && r.data.map | 0) || 0;
  if (seed && (seed !== SEED || map !== MAP_TYPE)) { location.search = '?seed=' + seed + '&map=' + map + '&join=' + r.room + (netSteam() ? '&transport=steam' : ''); return; }
  netJoin(r.room);
  m.joining = true;
  SFX.place();
}
// a page that came up to join (a code on another valley, a Steam invite, a
// rematch): the party screen, the join under way. A Steam rematch names the
// party's code, which is looked up; anything else is joined as it stands
function partyBootJoin(code) {
  const m = state.menu;
  m.screen = 'room'; m.joining = true;
  if (code.length === RM_CODE_N) m.code = code;
  if (netSteam() && code.length === RM_CODE_N) { partySeek(code, REMATCH_WAIT); return; }
  netJoin(code);
  rematchBootJoin();
}
// a letter into the box: the four letters a code is made of, nothing else
function codeType(ch) {
  const m = state.menu, c = String(ch || '').toUpperCase();
  if (!/^[A-Z0-9]$/.test(c) || m.code.length >= RM_CODE_N) return false;
  m.code += c;
  SFX.pickup();
  if (m.code.length === RM_CODE_N) partySeek(m.code);
  return true;
}
function codeBoxShown() { return state.menu.screen === 'room' && NET.role === 'host' && !NET.peers.size && !state.menu.joining; }
// Ctrl+V on a party of one: the first four-letter run in what was copied
pageListen(window, 'paste', (e) => {
  const m = state.menu;
  if (state.mode !== 'title' || !codeBoxShown()) return;
  const txt = ((e.clipboardData && e.clipboardData.getData('text')) || '').toUpperCase();
  const words = txt.match(new RegExp('\\b[A-Z0-9]{' + RM_CODE_N + '}\\b', 'g')) || [];
  e.preventDefault();
  if (!words.length) { m.codeShake = NAME_SHAKE_T; SFX.deny(); return; }
  m.code = words[words.length - 1]; m.codeOn = true;
  partySeek(m.code);
});
function updateRooms(dt) {
  const m = state.menu;
  if (m.codeShake > 0) m.codeShake = Math.max(0, m.codeShake - dt);
  // a code being looked for: joined the moment the list names it, a rattle when it never does
  if (m.seek) {
    const r = m.rooms.find((q) => seekMatch(q, m.seek.code));
    if (r) joinRoom(r);
    else if ((m.seek.t -= dt) <= 0) { m.seek = null; roomsFeedClose(); m.codeShake = NAME_SHAKE_T; SFX.deny(); if (m.joining) beginParty(NET.mode || 'quick'); }
  }
  // a join answered: the party's seats on a welcome, our own party again on a refusal
  if (m.screen === 'room' && NET.role === 'client' && m.joining) {
    if (NET.welcomed) { m.joining = false; m.joinWait = 0; m.codeOn = false; m.code = ''; beginRoom(); }
    else if (NET.refused || (NET.transport.error && !NET.transport.open)) {
      const why = NET.refused || NET.transport.error;
      netLeave();
      // back from a match: the leader may not have reopened the party yet, so
      // the join is tried again for a while before it counts as a refusal
      if (m.joinWait > 0 && why !== 'KICKED' && why !== 'VERSION') m.joinRetry = REMATCH_RETRY;
      else { m.joining = false; m.codeShake = NAME_SHAKE_T; SFX.deny(); beginParty(NET.mode || 'quick'); }
    }
  }
  if (m.joinWait > 0) {
    m.joinWait -= dt;
    if (m.joinRetry > 0 && NET.role === 'solo' && (m.joinRetry -= dt) <= 0) netJoin(JOIN_AT_BOOT);
    if (m.joinWait <= 0 && NET.role === 'solo') { m.joining = false; beginParty(NET.mode || 'quick'); }
  }
}

// ------------------------------------------------------------ the room
function beginRoom() {
  const m = state.menu;
  m.screen = 'room';
  m.rseat = -1; m.rword = 1; m.rkeys = false; m.talkOn = false;
  m.countT = 0; m.countN = -1;
  m.code = m.code || ''; m.codeShake = 0;
  partySeats();
  SFX.place();
  SFX.music.play('lobby');
}
// the room's host's body: ours, or the slot the welcome named
function roomHost() { return players[NET.isClient ? NET.hostSlot : localId]; }
// the five seats of side t, in slot order: the same five, the same order, on every screen
function roomSide(t) { return players.filter((p) => p.team === t); }
// the seats laid out: one column of your side's five, centred, and the words at the foot
function roomLayout() {
  const x = 24, w = VIEW_W - 48, sx = Math.round((VIEW_W - RS_W) / 2);
  const seats = roomSide(player ? player.team : 0).map((p, k) => ({ x: sx, y: RS_TOP + k * (RS_H + RS_GAP), w: RS_W, h: RS_H, p, k }));
  const labels = NET.isClient ? ['LEAVE', 'READY'] : ['LEAVE', 'FIND MATCH'];
  const box = { x: x + w - RM_CODE_W, y: 28, w: RM_CODE_W, h: RM_CODE_H };
  return { x, w, seats, box, words: roomWords(labels), labels };
}
// bare words side by side at the foot, the post-game page's grammar
function roomWords(labels) {
  const ws = labels.map((l) => pixelTextWidth(l, MENU_TXT_SCALE) + 8), gap = 56;
  let x = Math.round((VIEW_W - ws.reduce((s, w) => s + w, 0) - gap * (labels.length - 1)) / 2);
  return labels.map((label, i) => { const r = { label, x, y: VIEW_H - 36, w: ws[i], h: 7 * MENU_TXT_SCALE + 4 }; x += ws[i] + gap; return r; });
}
function inRect(r, pad) {
  pad = pad || 0;
  return mouse.x >= r.x - pad && mouse.x < r.x + r.w + pad && mouse.y >= r.y - pad && mouse.y < r.y + r.h + pad;
}
// what a click on seat s does from this screen: 'invite' (an empty seat),
// 'kick' (the leader shows a friend out) or null
function seatAct(s) {
  const p = s.p;
  if (p === player || !seatsOpen()) return null;
  if (p.control === 'none') return 'invite';
  return NET.role === 'host' && isHuman(p) ? 'kick' : null;
}
// the party's code as it sits top-right: a relay room's, or the one a Steam
// lobby carries in its data (a guest is told it with the roster)
function roomCode() {
  if (NET.isClient) return NET.code || '';
  const T = NET.transport, c = String((T && (T.code || T.room)) || '');
  return c.length === RM_CODE_N ? c : '';
}
function roomCodeRect(L) {
  const w = pixelTextWidth(roomCode(), 2);
  return { x: L.x + L.w - w, y: 16, w, h: 10 };
}
function roomHit() {
  const m = state.menu, L = roomLayout();
  for (let i = 0; i < L.words.length; i++) if (inRect(L.words[i], 3)) return { kind: 'word', w: L.labels[i] };
  if (roomCode() && inRect(roomCodeRect(L), 3)) return { kind: 'code' };
  const inv = roomInviteRect(L);
  if (inv && inRect(inv, 3)) return { kind: 'invite' };
  if (codeBoxShown() && inRect(L.box, 2)) return { kind: 'box' };
  if (inRect(talkLayout(L), 2)) return { kind: 'talk' };
  if (m.joining) return null;
  for (const s of L.seats) if (inRect(s)) {
    const act = seatAct(s);
    return act ? { kind: 'seat', id: s.p.id, act } : null;
  }
  return null;
}
// the code onto the clipboard, for a Discord message; it flashes white as it goes
function roomCopy() {
  const code = roomCode();
  if (!code) { SFX.deny(); return; }
  try { if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {}); } catch (e) { }
  state.menu.copyAt = performance.now() / 1000; // the flash's start, on the frame clock
  SFX.place();
}
// an empty seat's +: Steam's friends overlay where there is one, the code otherwise
function seatInvite() { if (roomInviteRect(roomLayout())) roomInvite(); else roomCopy(); }
function roomDo(h) {
  const m = state.menu;
  if (!h) return;
  if (h.kind === 'code') { roomCopy(); return; }
  if (h.kind === 'invite') { roomInvite(); return; }
  if (h.kind === 'box') { m.codeOn = true; m.code = ''; SFX.pickup(); return; }
  if (h.kind === 'talk') { talkOpen(); return; }
  if (h.kind === 'word') {
    if (h.w === 'LEAVE') leaveRoom();
    else if (h.w === 'FIND MATCH') partyFind();
    else if (h.w === 'READY') { netReady(!NET.ready.has(localId)); SFX.place(); }
    return;
  }
  if (h.act === 'invite') seatInvite();
  else if (h.act === 'kick') { seatKick(h.id); SFX.deny(); }
}
function roomClick() {
  const m = state.menu;
  if (m.roomsT < 1) return;
  const h = roomHit();
  if (!h || h.kind !== 'talk') m.talkOn = false; // a click anywhere else puts the chat line away
  if (!h || h.kind !== 'box') m.codeOn = false;
  roomDo(h);
}
// the keys walk a cursor down the five seats and onto the words; Enter does
// what a click there would. The CODE box, while lit, takes every key
function roomKey(k, e) {
  const m = state.menu, L = roomLayout();
  if (m.codeOn) {
    if (k === 'escape') { m.codeOn = false; SFX.pickup(); }
    else if (k === 'backspace') { m.code = m.code.slice(0, -1); SFX.pickup(); }
    else if (k === 'enter') { if (m.code.length === RM_CODE_N) partySeek(m.code); else m.codeOn = false; }
    else codeType(e && e.char && e.char.length === 1 ? e.char : k);
    return;
  }
  if (talkKey(k, e)) return; // a chat line being typed takes every key (js/ui/roomtalk.js)
  m.rkeys = true;
  if (k === 'escape' || k === 'backspace') { leaveRoom(); return; }
  const d = moveDir(k), at = L.seats.findIndex((s) => s.p.id === m.rseat);
  if (d === 'up' || d === 'down') {
    const k2 = at < 0 ? (d === 'up' ? L.seats.length - 1 : -1) : at + (d === 'down' ? 1 : -1);
    m.rseat = k2 < 0 ? (at < 0 ? -1 : L.seats[0].p.id) : k2 >= L.seats.length ? -1 : L.seats[k2].p.id;
    SFX.pickup();
  } else if ((d === 'left' || d === 'right') && at < 0) {
    m.rword = (m.rword + (d === 'right' ? 1 : L.labels.length - 1)) % L.labels.length;
    SFX.pickup();
  } else if (k === 'enter' || k === ' ') {
    if (at >= 0) { const act = seatAct(L.seats[at]); if (act) roomDo({ kind: 'seat', id: m.rseat, act }); else SFX.deny(); }
    else roomDo({ kind: 'word', w: L.labels[Math.min(m.rword, L.labels.length - 1)] });
  }
}
// every person in the room has said READY (the leader's own word is FIND MATCH)
function roomAllReady() { return players.every((p) => p.control !== 'remote' || NET.ready.has(p.id)); }
// the bots' level the room plays: RANKED's pinned one, the leader's own setting, a guest's copy of it
function roomLevel() { return NET.isClient ? NET.aiLevel : NET.botLv != null ? NET.botLv : settings.aiLevel | 0; }

// ------------------------------------------------------------ the rematch
// League's "play again". A world is grown at load, so a match's valley
// cannot be played twice: the moment a match ends the leader rolls the next
// seed and tells every guest (`rematch`, rematchOffer); the leader's LOBBY
// keeps the party's code, mode and each person's slot by uid for the next
// page (sessionStorage) and reloads as the host of the SAME code on the new
// valley, straight onto the party - a relay room by its code, a Steam lobby
// made afresh with that code in its data. A guest's own LOBBY, whenever it
// presses it, reloads onto that seed and joins the code from boot (a Steam
// one looked up on the lobby list), retrying while the leader's page is
// still on its way back, and the leader hands it the slot it held. The
// leader's leaving does not end a guest's match as HOST LEFT once the
// rematch is heard.
const REMATCH_KEY = 'softfall.rematch';
const REMATCH_WAIT = 180; // s a guest back from a match keeps trying the party's code (the leader may still be reading the stats)
const REMATCH_RETRY = 1;  // s between those tries
let rematchCarry = null;  // a reopened party's: { seats: uid -> slot } from the last match

function rematchUrl() {
  if (!NET.mode) return null; // a page that never opened a party: the title, as it was
  const base = location.pathname + '?map=' + MAP_TYPE, steam = netSteam() ? '&transport=steam' : '';
  const code = roomCode();
  if (NET.isHost) {
    const seed = NET.nextSeed || rollSeed();
    if (NET.peers.size) NET.transport.send('*', { t: 'rematch', seed, map: MAP_TYPE });
    const seats = {};
    for (const pr of NET.peers.values()) seats[pr.uid] = pr.slot;
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: NET.mode, seats })); } catch (e) { }
    return base + '&seed=' + seed + '&net=host&back=1' + steam + (code ? (steam ? '&code=' : '&room=') + code : '');
  }
  if (NET.rematch && NET.rematch.room) return base.replace(/map=\d+/, 'map=' + NET.rematch.map) + '&seed=' + NET.rematch.seed + '&join=' + NET.rematch.room + '&back=1' + steam;
  return null;
}
// the leader's, every step: the first step of an ended match picks the next valley
function rematchOffer() {
  if (NET.nextSeed || !(state.over === 'won' || state.over === 'lost') || !roomCode()) return;
  NET.nextSeed = rollSeed();
  NET.transport.send('*', { t: 'rematch', seed: NET.nextSeed, map: MAP_TYPE });
}
function rematchHeard(msg) { NET.rematch = { seed: msg.seed | 0, map: msg.map | 0, room: roomCode() }; }
// the slot a returning person held last match, for netHostHello
function rematchSeat(uid) {
  const s = rematchCarry ? rematchCarry.seats[uid] : undefined;
  if (s === undefined) return null;
  delete rematchCarry.seats[uid];
  return { slot: s };
}
function rematchBootHost() {
  if (NET.role !== 'host' || !/[?&]back=1/.test(location.search)) return;
  let c = null;
  try { c = JSON.parse(sessionStorage.getItem(REMATCH_KEY) || 'null'); sessionStorage.removeItem(REMATCH_KEY); } catch (e) { }
  NET.mode = (c && PARTY_MODES[c.mode]) ? c.mode : 'quick';
  rematchCarry = { seats: (c && c.seats) || {} };
  beginRoom();
}
function rematchBootJoin() {
  if (/[?&]back=1/.test(location.search)) state.menu.joinWait = REMATCH_WAIT;
}

// ------------------------------------------------------------ the pixels
function drawXMark(x, y, col) { ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + 4 - i, y + i, 1, 1); } }
function drawPlusMark(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 2, 5, 1); ctx.fillRect(x + 2, y, 1, 5); }
function drawCrown(x, y) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1); ctx.fillRect(x, y + 1, 5, 1); }
// a word at the foot: white, gold under the pointer or the keys, lifted a px
function drawRoomWord(r, hot, dim, col) {
  drawPixelTextOutline(ctx, r.label, r.x + 4, r.y + 2 - (hot ? 1 : 0), dim ? SC_DIM : hot ? '#ffd95c' : col || SC_LIT, 'rgba(8,12,28,0.9)', MENU_TXT_SCALE);
}
const RM_OK = '#7fd88a', RM_SLOW = '#e8b04a', RM_BAD = '#e0524f'; // READY's tick and the link's three grades
const PING_GOOD = 90, PING_OK = 180; // ms: three bars under the first, two under the second, one past it
// a tick, 5x4
function drawTick(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 1, y + 3, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 3, y + 1, 1, 1); ctx.fillRect(x + 4, y, 1, 1); }
// a person's link: three rising bars, lit by grade; an unmeasured link is three dark bars
function drawPingBars(x, y, ms) {
  const n = ms == null ? 0 : ms < PING_GOOD ? 3 : ms < PING_OK ? 2 : 1;
  const col = n === 3 ? RM_OK : n === 2 ? RM_SLOW : RM_BAD;
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n ? col : SC_EDGE; ctx.fillRect(x + i * 3, y + 6 - (i + 1) * 2, 2, (i + 1) * 2); }
}
// a small pip that says the relay is there: green and breathing while the
// socket is open, red and blinking while it is not
function drawRelayPip(x, y, ok, now) {
  const on = ok ? 0.6 + 0.4 * Math.sin(now * 3) : (Math.floor(now * 3) % 2 ? 1 : 0.25);
  const a0 = ctx.globalAlpha;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(x, y, 6, 6);
  ctx.fillStyle = '#0f1632'; ctx.fillRect(x - 1, y - 1, 6, 6);
  ctx.globalAlpha = a0 * on;
  ctx.fillStyle = ok ? '#7fd88a' : '#e0524f';
  ctx.fillRect(x, y, 4, 4);
  ctx.globalAlpha = a0;
}
// The CODE box: four slots on a plate, the letters typed so far in them, a
// gold rim and a blinking caret while it is lit, a rattle on a code no room
// answers to. Empty and unlit it reads CODE, dim, in its middle.
function drawCodeBox(r, m, now, hot) {
  const dx = m.codeShake > 0 ? Math.round(Math.sin(m.codeShake * 60) * 2 * (m.codeShake / NAME_SHAKE_T)) : 0;
  const x = r.x + dx, y = r.y;
  ctx.fillStyle = m.codeOn ? '#c89a3c' : hot ? SC_LBL : SC_EDGE; ctx.fillRect(x, y, r.w, r.h);
  ctx.fillStyle = m.codeOn ? SC_YOU : SC_PLATE; ctx.fillRect(x + 1, y + 1, r.w - 2, r.h - 2);
  if (!m.codeOn && !m.code) { const t = 'CODE'; drawPixelText(ctx, t, x + ((r.w - pixelTextWidth(t)) >> 1), y + 6, hot ? SC_TXT : SC_DIM, 1); return; }
  const pitch = 12, x0 = x + ((r.w - pitch * RM_CODE_N + 4) >> 1);
  for (let i = 0; i < RM_CODE_N; i++) {
    const cx = x0 + i * pitch, ch = m.code[i];
    if (ch) drawPixelText(ctx, ch, cx, y + 3, m.codeShake > 0 ? '#e0524f' : SC_GOLD, 2);
    else { ctx.fillStyle = i === m.code.length && m.codeOn && Math.floor(now * 2.5) % 2 ? SC_GOLD : SC_EDGE; ctx.fillRect(cx, y + 12, 6, 1); }
  }
}
// One seat: the side's paint down its edge, the face and the name, and in
// RANKED the person's rating under it. Yours wears the gold rim, the
// leader's face a crown, a friend's name its READY tick and its ping bars
// at the far end; a seat that just changed hands flashes (cardFx,
// updateTitle). An empty seat is a dotted well with the gold + that invites.
// Under the pointer it lights, and the leader's hand on a friend shows the X.
function drawRoomSeat(s, act, flash) {
  const p = s.p, me = p === player, x = s.x, y = s.y, w = s.w, h = s.h;
  ctx.fillStyle = flash ? '#3a3e46' : act ? SC_HOT : me ? SC_YOU : SC_PLATE; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TEAMS[skin(p.team)].mark; ctx.fillRect(x, y, 2, h);
  if (me) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(x + 2, y, w - 2, 1); ctx.fillRect(x + 2, y + h - 1, w - 2, 1); ctx.fillRect(x + w - 1, y, 1, h); }
  const tx = x + w - 14, ty = y + ((h - 5) >> 1); // the far end: the leader's hand
  if (!isHuman(p)) { // an empty seat: a dotted well where the face would be, and the invite's +
    ctx.fillStyle = SC_EDGE;
    for (let i = 0; i < 26; i += 2) { ctx.fillRect(x + 8 + i, y + 4, 1, 1); ctx.fillRect(x + 8 + i, y + 29, 1, 1); ctx.fillRect(x + 8, y + 4 + i, 1, 1); ctx.fillRect(x + 33, y + 4 + i, 1, 1); }
    if (seatsOpen()) drawPlusMark(tx, ty, act ? '#ffd95c' : SC_GOLD);
    return;
  }
  drawScoreFace(x + 8, y + 4, 26, { id: p.id, you: me, team: p.team, level: p.level || 1 });
  if (p === roomHost()) drawCrown(x + 19, y + 1);
  const ny = NET.mode === 'ranked' ? y + 10 : y + 14;
  drawPixelText(ctx, p.name, x + 42, ny, me ? SC_GOLD : SC_LIT, 1);
  // READY: a tick after the name (the leader's word is FIND MATCH, so it wears none)
  if (p !== roomHost() && NET.ready.has(p.id)) drawTick(x + 46 + pixelTextWidth(p.name), ny, RM_OK);
  if (NET.mode === 'ranked') drawPixelText(ctx, String(NET.ranks[p.id] || PROFILE.RANK_START), x + 42, y + 19, SC_DIM, 1);
  if (p !== roomHost()) drawPingBars(tx - 22, y + 13, NET.pings[p.id]); // a guest's link to the leader
  if (act === 'kick') drawXMark(tx, ty, '#e0524f');
}

function renderRoom(now, a) {
  const m = state.menu, L = roomLayout();
  const hit = m.roomsT >= 1 ? roomHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPixelTextShadow(ctx, partyName(), L.x, 16, SC_LIT, SC_INK, 2);
  drawPixelText(ctx, partySize() + ' / ' + L.seats.length, L.x, 34, SC_LBL, 1);
  // the code a leader reads to a friend, gold, with the link's pip (a
  // click copies it: white for a moment, lit under the pointer), and
  // INVITE before it on Steam: the friends overlay
  const code = roomCode(), cw = code ? pixelTextWidth(code, 2) : 0;
  if (cw) drawPixelText(ctx, code, L.x + L.w - cw, 16, now - (m.copyAt || -9) < 0.5 ? SC_LIT : hit && hit.kind === 'code' ? '#ffd95c' : SC_GOLD, 2);
  drawRelayPip(L.x + L.w - cw - 10, 19, !!(NET.transport && NET.transport.open), now);
  const inv = roomInviteRect(L);
  if (inv) drawPixelText(ctx, 'INVITE', inv.x, inv.y, hit && hit.kind === 'invite' ? '#ffd95c' : SC_LIT, 2);
  // alone, the box that joins a friend's party; gold while its code is looked for
  if (codeBoxShown() || m.joining) drawCodeBox(L.box, m.joining || m.seek ? Object.assign({}, m, { codeOn: true }) : m, now, hit && hit.kind === 'box');
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 46, L.w, 1);
  if (!m.joining) for (const s of L.seats) {
    let act = hit && hit.kind === 'seat' && hit.id === s.p.id ? hit.act : null;
    if (!act && m.rseat === s.p.id && !hit) act = seatAct(s) || 'none'; // the keys' cursor lights the seat too
    drawRoomSeat(s, act === 'none' ? null : act, m.cardFx && m.cardFx[s.p.id] > 0);
    if (m.rseat === s.p.id && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(s.x, s.y, 2, s.h); }
  }
  drawTalk(L, now, hit && hit.kind === 'talk');
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.w === w.label : m.rkeys && m.rseat < 0 && m.rword === i;
    // FIND MATCH is dim until every friend is READY; a guest's READY is green once said
    drawRoomWord(w, hot, (w.label === 'FIND MATCH' && !roomAllReady()) || (m.joining && w.label !== 'LEAVE'), w.label === 'READY' && NET.ready.has(localId) ? RM_OK : null);
  }
  ctx.globalAlpha = 1;
}

// The room this screen is in, on the pick screen: the code on its plate
// under the relay pip, at the head of your side's roster - what a host reads
// to a friend, and what a guest sees it joined
function drawCodePlate(x, y, code, col, sc) {
  sc = sc || 1;
  const w = pixelTextWidth(code, sc) + 6, h = 5 * sc + 6;
  ctx.fillStyle = 'rgba(4,6,18,0.55)'; ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = '#35426e'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#0a0e23'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  drawPixelTextShadow(ctx, code, x + 3, y + 3, col, '#0a0e23', sc);
  return w;
}
function drawRoomPlate(now, a) {
  if (NET.role === 'solo') return;
  const code = roomCode(), x = LOBBY_PAD, y = LOBBY_HEAD - 20;
  ctx.globalAlpha = a;
  drawRelayPip(x, y + 6, !!(NET.transport && NET.transport.open), now);
  if (code) drawCodePlate(x + 9, y, code, '#ffd95c', 2);
}
// In a match, a client whose socket is down: a red pip blinking top-centre
// while the transport redials, and nothing at all while the link is good
function drawNetLink(now) {
  if (!NET.isClient || (NET.transport && NET.transport.open && NET.synced)) return;
  drawRelayPip(Math.round(VIEW_W / 2) - 2, 3, false, now);
}
