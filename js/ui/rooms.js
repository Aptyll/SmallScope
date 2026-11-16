// ------------------------------------------------------------ party lobby
// The party's logic: the screen it shows is the hub (js/ui/hub.js), the
// landing page where your side's seats stand with PLAY beside them
// (docs/pvp-architecture.md has the wire).
//
// A party IS a room: the hub hosts one the moment it opens (netHost, js/net/net.js),
// on the relay or, under the wrapper with Steam asked for (netSteam), as a
// Steam lobby, and it works the same with neither there - a party of one.
// Under Steam it is open before the hub shows (the standing party, below).
// Its seats are YOUR side's: you, the friends who came in (a READY tick,
// three ping bars) and the empty ones, each with a gold + that invites -
// Steam's friends overlay under the wrapper, the code onto the clipboard
// otherwise. Off Steam the FRIENDS panel wears the room's code (a click
// copies it) and, alone in your party, JOIN takes a friend's four letters
// (click it and type, or paste anywhere) - the code finds its room off the
// relay's list or Steam's lobbies (partySeek).
// A guest's READY ticks its seat; the leader's PLAY stays dim until every
// friend has, then looks for a match, fills every empty seat with bots and
// takes the whole party to the hero select (netPhase 'pick', the lobby in
// js/ui/champ-select.js) and from there to the drop. The rival side is never
// shown here: it is another party met by matchmaking (js/ui/matchmaking.js),
// or bots. After the match, LOBBY brings the party back on a fresh valley
// (the rematch, below).
// One mode: RANKED. A profile that has never seen a match through plays
// its first PLAY alone as FIRST MATCH (roomGo): EASY bots with the coach
// (js/ui/guide.js), straight to bots, no matchmaking
const PARTY_MODES = { ranked: 'RANKED', guide: 'FIRST MATCH' };
// people on your side at most: three, the 3v3's side (a side's seats while the
// match still seats more: the rest are bots at the drop)
const PARTY_MAX = 3;
function partyCap() { return Math.min(PARTY_MAX, MAX_PLAYERS / 2); }
const RM_CODE_N = 4;                   // letters in a code (makeCode, app/server.js; steamCode, js/net/transport-steam.js)
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
  m.rooms = [];
  roomsFeed = (netSteam() ? steamRooms : (cb) => wsRooms(netRelay(), cb))((rooms) => { m.rooms = rooms; });
}
function roomOk(r) { return r.data && r.data.patch === PATCH_TXT; }

// THE STANDING PARTY. Under Steam a screen outside a match always holds a
// party, as League's client does: from the first frame of the title, on
// every menu and back from every match, its own (a lobby of one) or the one
// it joined. Steam's Join Game on you, a friend's invite and the gold step
// on your row all need a lobby to land in, so they work from wherever you
// are, not only from the party screen. The party is logic, not a screen: a
// friend who comes in while you are on the title takes you to the seats
// (partyArrived), and whatever page shows the seats next reads the same
// party. Off Steam (a browser, the relay) a party still opens with a mode,
// as before: the relay's rooms are not a friends list.
const PARTY_IDLE = 'ranked'; // the standing party's mode
function partyStandOk() {
  const m = state.menu;
  return netSteam() && state.mode === 'title' && NET.role === 'solo' && !m.joining && !(m.joinWait > 0) && !m.seek && !state.fade && !CROSS;
}
function partyStand() { netHost(); NET.mode = PARTY_IDLE; }
// the standing party kept as you leave the seats: yours alone, not mid-meeting
function partyKeep() { return netSteam() && NET.role === 'host' && !NET.peers.size && !(NET.transport && NET.transport.error) && !(NET.seek && (NET.seek.rival || NET.seek.crossing)); }
// a friend came into your party while this screen is on the title: the seats
function partyArrived() {
  const m = state.menu;
  if (state.mode === 'title' && NET.role === 'host' && NET.peers.size && NET.phase === 'room' && m.screen === 'menu' && !m.panel && !state.fade) beginRoom();
}
// the hub's way in (hubEnter): this screen's own party (the standing one,
// or one hosted now), in that mode
function beginParty(mode) {
  if (NET.role === 'client') netLeave();
  if (NET.role === 'solo' || (NET.role === 'host' && !NET.peers.size && NET.transport.error)) netHost();
  if (NET.mode !== mode) NET.ready.clear(); // said to the old mode (modeSet)
  NET.mode = mode;
  beginRoom();
}
// out of the party: a guest walks out of someone else's and a leader with
// friends closes its own; a leader alone keeps its standing party
// (partyKeep). The hub comes back at once on a party of one (hubEnter)
function leaveRoom() {
  roomsFeedClose();
  if (partyKeep()) {
    NET.seek = null;
    NET.mode = PARTY_IDLE; NET.ready.clear();
    netHostRoom();
  } else {
    netLeave();
    NET.mode = null;
  }
  homeParty = null; // walked out of a match met by matchmaking: no party to go back to (js/ui/matchmaking.js)
  const m = state.menu;
  m.screen = 'menu'; m.seek = null; m.joining = false;
  FRIENDS.invites = []; // the friends invited belong to the party just left
  SFX.pickup();
}
// the leader's seats while the party waits: every seat on its side that is
// not a person stands empty for a friend, every rival seat is a bot
function partySeats() {
  if (NET.role !== 'host' || !seatsOpen()) return;
  for (const p of players) if (!isHuman(p)) p.control = p.team === player.team ? 'none' : 'ai';
  netHostRoster(); netHostRoom();
}
function partySize() { return roomSide(player.team).filter(isHuman).length; }
// A seat's RANKED rating: your own from your profile (a party of one never
// builds a roster, so NET.ranks never holds it), anyone else's off the
// roster or their hello
function seatRank(p) { return p === player ? PROFILE.rank() : NET.ranks[p.id] || PROFILE.RANK_START; }
// RANKED's bots: a level off the people's average rating (both parties' when two met), a band either side of the start
function rankLevel() {
  const rs = players.filter(isHuman).map(seatRank);
  const avg = rs.reduce((s, r) => s + r, 0) / Math.max(1, rs.length);
  return Math.max(0, Math.min(AI_LEVELS.length - 1, 1 + Math.floor((avg - PROFILE.RANK_START) / RANK_BAND + 0.5)));
}
// a match's ending, once (endMatch, js/sim/player.js): a ranked one moves the
// profile's rating, and any match seen through stops the title offering FIRST MATCH
function rankResult(won) {
  if (NET.mode === 'ranked') PROFILE.addRank(won ? RANK_STEP : -RANK_STEP);
  PROFILE.setGuided();
}

// PLAY: every friend READY, then the party looks for another (seekStart,
// js/ui/matchmaking.js; a second press stops it), and then bots into every
// empty seat and everyone on to the hero select. The bots' level is pinned
// (NET.botLv, read by aiProfile, js/ai/ai-skill.js): RANKED's off the
// party's rating, FIRST MATCH's EASY.
function partyFind() {
  const m = state.menu;
  if (NET.role !== 'host' || !seatsOpen()) return;
  if (NET.seek) { seekCancel(); return; }
  if (!roomAllReady()) { // the seats it waits on flash, and nothing starts
    for (const p of players) if (p.control === 'remote' && !NET.ready.has(p.id)) m.cardFx[p.id] = 0.6;
    SFX.deny();
    return;
  }
  m.pressT = 0.12;
  if (!seekStart()) partyStart(); // RANKED looks for another party first (js/ui/matchmaking.js)
}
// the match is on: every empty seat a bot, the party on to the hero select
function partyStart() {
  for (const p of players) if (!isHuman(p)) p.control = 'ai';
  NET.botLv = NET.mode === 'ranked' ? rankLevel() : NET.mode === 'guide' ? 0 : null; // FIRST MATCH: EASY
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
  if (partyStandOk()) partyStand();
  partyArrived();
  hubEnter(); // the title is only passed through, onto the hub (js/ui/hub.js)
  updateSeek(dt); // the leader's PLAY looking for another party (js/ui/matchmaking.js)
  if (m.codeShake > 0) m.codeShake = Math.max(0, m.codeShake - dt);
  // a code being looked for: joined the moment the list names it, a rattle when it never does
  if (m.seek) {
    const r = m.rooms.find((q) => seekMatch(q, m.seek.code));
    if (r) joinRoom(r);
    else if ((m.seek.t -= dt) <= 0) { m.seek = null; roomsFeedClose(); m.codeShake = NAME_SHAKE_T; SFX.deny(); if (m.joining) partyGiveUp(); }
  }
  // a join answered: the party's seats on a welcome, our own party again on a refusal
  if (m.screen === 'room' && NET.role === 'client' && m.joining) {
    if (NET.welcomed) { m.joining = false; m.joinWait = 0; m.codeOn = false; m.code = ''; beginRoom(); }
    else if (NET.refused || (NET.transport.error && !NET.transport.open)) {
      const why = NET.refused || NET.transport.error;
      netLeave();
      // back from a match: the leader may not have reopened the party yet, so
      // the join is tried again for a while before it counts as a refusal
      if (m.joinWait > 0 && why !== 'KICKED' && why !== 'VERSION' && why !== 'MATCHED') m.joinRetry = REMATCH_RETRY;
      else { m.joining = false; m.codeShake = NAME_SHAKE_T; SFX.deny(); partyGiveUp(); }
    }
  }
  if (m.joinWait > 0) {
    m.joinWait -= dt;
    if (m.joinRetry > 0 && NET.role === 'solo' && (m.joinRetry -= dt) <= 0) netJoin(JOIN_AT_BOOT);
    if (m.joinWait <= 0 && NET.role === 'solo') { m.joining = false; partyGiveUp(); }
  }
}
// a join that never landed: our own party again on the title
function partyGiveUp() {
  if (homeParty) { crossHome(); return; } // a party that crossed to meet another and was turned away: home (js/ui/matchmaking.js)
  beginParty('ranked');
}

// ------------------------------------------------------------ the room
function beginRoom() {
  const m = state.menu;
  m.screen = 'room';
  m.rseat = -1; m.rword = 1; m.rkeys = false; m.talkOn = false; m.fcur = -1;
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
// your side's seats on the hub: partyCap of them, the people first and then
// the empty seats a friend would take, in slot order on every screen
function partySide() {
  const s = roomSide(player.team), cap = partyCap();
  if (s.length <= cap) return s;
  const keep = new Set(s.filter(isHuman).concat(s.filter((p) => !isHuman(p))).slice(0, cap));
  return s.filter((p) => keep.has(p));
}
// what a click on seat s does from this screen: 'invite' (an empty seat),
// 'kick' (the leader shows a friend out) or null
function seatAct(s) {
  const p = s.p;
  if (p === player || !seatsOpen()) return null;
  if (p.control === 'none') return 'invite';
  return NET.role === 'host' && isHuman(p) ? 'kick' : null;
}
// the party's code as the FRIENDS panel wears it: a relay room's, or the one a Steam
// lobby carries in its data (a guest is told it with the roster)
function roomCode() {
  if (NET.isClient) return NET.code || '';
  const T = NET.transport, c = String((T && (T.code || T.room)) || '');
  return c.length === RM_CODE_N ? c : '';
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
function seatInvite() { if (netSteam() && NET.transport && NET.transport.lobbyId) roomInvite(); else roomCopy(); }
// PLAY, or a guest's READY. The leader's mode is set here, at the press:
// alone on a profile that has never seen a match through, FIRST MATCH;
// otherwise RANKED
function roomGo(label) {
  if (label === 'ready') { netReady(!NET.ready.has(localId)); SFX.place(); return; }
  if (NET.role === 'host' && !NET.seek) {
    const mode = !PROFILE.guided() && !NET.peers.size ? 'guide' : 'ranked';
    if (NET.mode !== mode) { NET.mode = mode; netHostRoom(); }
  }
  partyFind(); // PLAY, or the clock that stops the looking
}
function roomDo(h) {
  const m = state.menu;
  if (!h) return;
  if (h.kind === 'code') { roomCopy(); return; }
  if (h.kind === 'box') { m.codeOn = true; m.code = ''; SFX.pickup(); return; }
  if (h.kind === 'talk') { if (!m.talkOn) talkOpen(); return; } // a click on the open chat keeps the line
  if (h.kind === 'friend') { if (h.f.head) friendHeadDo(); else friendDo(h.f); return; }
  if (h.kind === 'leave') { leaveRoom(); return; }
  if (h.kind === 'profile') { openSeatProfile(h.id, 'room'); return; }
  if (h.kind === 'go') { if (m.joining) SFX.deny(); else roomGo(hubLayout().label); return; }
  if (hubDo(h)) return; // a panel's click: its whole page (js/ui/hub.js)
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
// the keys walk a cursor along the seats (left and right), right off the
// last one onto PLAY, down from PLAY onto the X that leaves, right from PLAY
// into the friends' panel; Enter does what a click there would. Esc opens
// the settings. The code's slots, while lit, take every key
function roomKey(k, e) {
  const m = state.menu, L = hubLayout();
  if (m.codeOn) {
    if (k === 'escape') { m.codeOn = false; SFX.pickup(); }
    else if (k === 'backspace') { m.code = m.code.slice(0, -1); SFX.pickup(); }
    else if (k === 'enter') { if (m.code.length === RM_CODE_N) partySeek(m.code); else m.codeOn = false; }
    else codeType(e && e.char && e.char.length === 1 ? e.char : k);
    return;
  }
  if ((m.talkOn || hubTalking()) && talkKey(k, e)) return; // the chat, in a party with people: a line being typed takes every key (js/ui/roomtalk.js)
  if (k === 'escape') { openMenuPanel('settings'); return; }
  m.rkeys = true;
  const d = moveDir(k);
  if (m.fcur >= 0 && friendsKey(k, L)) return; // the keys in the friends' panel (js/ui/friends.js)
  const at = L.seats.findIndex((s) => s.p.id === m.rseat);
  if (at >= 0) { // on a seat
    if (d === 'left' || d === 'right') {
      const to = at + (d === 'right' ? 1 : -1);
      if (to >= L.seats.length) { m.rseat = -1; m.rword = 1; }
      else if (to >= 0) m.rseat = L.seats[to].p.id;
      SFX.pickup();
    } else if (k === 'enter' || k === ' ') { const act = seatAct(L.seats[at]); if (act) roomDo({ kind: 'seat', id: m.rseat, act }); else SFX.deny(); }
    return;
  }
  // on PLAY (rword 1) or the X under it (0)
  if (d === 'left') { m.rseat = L.seats[L.seats.length - 1].p.id; SFX.pickup(); }
  else if (d === 'right' && friendsLayout(L)) { m.fcur = 0; SFX.pickup(); }
  else if (d === 'down' && L.leave) { m.rword = 0; SFX.pickup(); }
  else if (d === 'up') { m.rword = 1; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') roomDo({ kind: m.rword === 0 && L.leave ? 'leave' : 'go' });
}
function roomAllReady() { return players.every((p) => p.control !== 'remote' || NET.ready.has(p.id)); }
// the bots' level the room plays: the pinned one, RANKED's off the rating, FIRST MATCH's EASY, a guest's copy of it
function roomLevel() { return NET.isClient ? NET.aiLevel : NET.botLv != null ? NET.botLv : NET.mode === 'guide' ? 0 : rankLevel(); }

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

// this page's address with the party's and the match's words taken off: it boots onto the title
function titleUrl() {
  const q = new URLSearchParams(location.search);
  for (const k of ['back', 'net', 'room', 'code', 'join', 'lobby']) q.delete(k);
  const t = q.toString();
  return location.pathname + (t ? '?' + t : '');
}
function rematchUrl() {
  if (homeParty) return crossHomeUrl(); // a party that crossed over for this match goes back to its own (js/ui/matchmaking.js)
  if (!NET.mode) return null; // a page that never opened a party: the title, as it was
  if (NET.mode === 'guide' && NET.isHost && !NET.peers.size) return titleUrl(); // a FIRST MATCH alone ends on a fresh hub
  const base = location.pathname + '?back=1', steam = netSteam() ? '&transport=steam' : '';
  const code = roomCode();
  if (NET.isHost) {
    if (NET.peers.size) NET.transport.send('*', { t: 'rematch' });
    const seats = {};
    for (const pr of NET.peers.values()) if (!pr.cross) seats[pr.uid] = pr.slot; // the rival party goes home
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: NET.mode, seats })); } catch (e) { }
    return base + '&net=host' + steam + (code ? (steam ? '&code=' : '&room=') + code : '');
  }
  if (NET.rematch && NET.rematch.room) return base + '&join=' + NET.rematch.room + steam;
  return null;
}
// the leader's, every step: the first step of an ended match tells the party where to come back to
function rematchOffer() {
  if (NET.rematchSent || !(state.over === 'won' || state.over === 'lost') || !roomCode()) return;
  NET.rematchSent = true;
  NET.transport.send('*', { t: 'rematch' });
}
function rematchHeard() {
  NET.rematch = { room: roomCode() };
}
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
  NET.mode = 'ranked'; // after the FIRST MATCH the party plays for real
  rematchCarry = { seats: (c && c.seats) || {} };
  beginRoom();
}
function rematchBootJoin() {
  // a party crossing to meet another joins a room that is already up: a few tries, then home (js/ui/matchmaking.js)
  if (/[?&]back=1/.test(location.search)) state.menu.joinWait = CROSS ? MATCH_JOIN : REMATCH_WAIT;
}

// a page going elsewhere (a crossing party, a guest following its leader):
// the reroll's whiteout, then the new URL
function pageGo(url, secs) {
  if (state.fade) return;
  SFX.dodge();
  SFX.music.stop(0.45);
  state.fade = { a: 0, to: 1, spd: 1 / (secs || 0.55), color: '#f4f7ff', then: () => {
    try { sessionStorage.setItem('softfall.reroll', '1'); } catch (e) { }
    location.href = url;
  } };
}

// ------------------------------------------------------------ the pixels
function drawXMark(x, y, col) { ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + 4 - i, y + i, 1, 1); } }
function drawPlusMark(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 2, 5, 1); ctx.fillRect(x + 2, y, 1, 5); }
function drawCrown(x, y) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1); ctx.fillRect(x, y + 1, 5, 1); }
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
// In a match, a client whose socket is down: a red pip blinking top-centre
// while the transport redials, and nothing at all while the link is good
function drawNetLink(now) {
  if (!NET.isClient || (NET.transport && NET.transport.open && NET.synced)) return;
  drawRelayPip(Math.round(VIEW_W / 2) - 2, 3, false, now);
}
