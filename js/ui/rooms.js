// ------------------------------------------------------------ party lobby
// The screen every mode opens (QUICKPLAY, RANKED, js/ui/menu.js), League's
// party lobby read in the post-game page's Graphite (js/ui/lobby.js): flat,
// opaque, the mode's name for a head (the leader's click opens the list of
// modes: modeSet), the party's one button at the foot
// (docs/pvp-architecture.md has the wire).
//
// A party IS a room: the screen hosts one the moment it opens (netHost, js/net/net.js),
// on the relay or, under the wrapper with Steam asked for (netSteam), as a
// Steam lobby, and it works the same with neither there - a party of one.
// Its five seats are YOUR side's, in a row with you in the middle: you (the
// gold rim), the friends who came in (a READY tick, three ping bars) and the
// empty ones, each a dotted well with a gold + that invites - Steam's friends
// overlay under the wrapper, the code onto the clipboard otherwise. The
// social column down the right edge (drawSocial, js/ui/friends.js) wears the
// room's code in gold under your name (a click copies it); alone in your
// party, JOIN right of the head takes a friend's four letters (click it and
// type, or paste anywhere) - the code finds its room off the relay's list or
// Steam's lobbies (partySeek).
// Chat sits bottom-left (js/ui/roomtalk.js). A guest's READY ticks its
// name; the leader's FIND MATCH stays dim until every friend has, then fills
// every empty seat on both sides with bots and takes the whole party to the
// hero select (netPhase 'pick', the lobby in js/ui/menu.js) and from there
// to the drop. The rival side is never shown here: it is another party met
// by matchmaking (js/ui/matchmaking.js), or bots. After the match, LOBBY brings the party back to
// this screen on a fresh valley (the rematch, below).
const PARTY_MODES = { quick: 'QUICKPLAY', ranked: 'RANKED', practice: 'PRACTICE TOOL' };
const RM_CODE_N = 4;                   // letters in a code (makeCode, app/server.js; steamCode, js/net/transport-steam.js)
const RS_TOP = 76, RS_H = 150, RS_GAP = 6, RS_W = 80; // the seats, League's row of five: top, a seat's height, between seats, a seat's width
const RS_FACE = 72;                    // a seat's portrait, the hero at 3x
const RM_HEAD_Y = 12, RM_HEAD_W = 176, RM_HEAD_H = 22; // the head's two plates, mirrored: the mode (left) and JOIN with its four slots (right)
const RM_BTN_W = 140, RM_BTN_H = 22, RM_X_W = 22, RM_FOOT = 34; // the foot: FIND MATCH's button, the X attached before it, its top above the screen's foot
const RM_SIDE_W = 128;                 // the foot's two end plates, mirrored and as tall as the button: the chat (left) and INVITE (right)
const RM_INVITED = 4;                  // names INVITE lists over its plate
const RM_WASH = 0.84;                  // how much of the title world the screen's wash hides
const RM_LIST_H = 14;                  // a row of the modes' list a click on the head opens
const RS_HEAD = -2;                    // menu.rseat on the mode's name (-1 is the foot, else a seat's slot)
const RS_BOTS = -3;                    // ...and on the bots' level, between the head's plates
const RM_BOTS_W = 84;                  // the bots' level's plate at its widest
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
  homeParty = null; // walked out of a match met by matchmaking: no party to go back to (js/ui/matchmaking.js)
  const m = state.menu;
  m.screen = 'menu'; m.seek = null; m.joining = false;
  FRIENDS.invites = []; // the names over INVITE belong to the party just left
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
// The leader turns the party's mode in place: a click on the head opens the
// list of PARTY_MODES under it, a click on one sets it (the keys: Enter on
// the head, up and down, Enter). Every friend's READY is spent on a change,
// since they said it to the old mode; the roster carries the new one to
// their screens.
function modeSwapOk() { return NET.role === 'host' && seatsOpen() && !state.menu.joining && !NET.seek; }
function modeSet(mode) {
  const m = state.menu;
  m.modeOpen = false;
  if (!modeSwapOk() || !PARTY_MODES[mode]) { SFX.deny(); return; }
  if (mode !== NET.mode) {
    NET.mode = mode;
    NET.ready.clear();
    m.modeFx = 0.25;
    netHostRoster(); netHostRoom();
  }
  SFX.pickup();
}
function modeRect(L) { return { x: L.x, y: RM_HEAD_Y, w: RM_HEAD_W, h: RM_HEAD_H }; }
// the list under the head: every mode, the party's in gold
function modeListRects(L) { return Object.keys(PARTY_MODES).map((k, i) => ({ k, x: L.x, y: RM_HEAD_Y + RM_HEAD_H + 1 + i * RM_LIST_H, w: RM_HEAD_W, h: RM_LIST_H })); }
// The bots' level, the head's middle plate between the mode and JOIN: its
// grade as rising bars in its colour (drawBotBars) and its name
// (AI_LEVELS, js/ai/ai-skill.js). The leader's click opens the levels under
// it (botsSet: settings.aiLevel, remembered, and the roster carries it to
// every guest's screen). RANKED's level follows the party's rating, so there
// it only shows; the practice field has no bots, and while the party looks
// for a match the clock stands there instead.
function botsShown() { return NET.mode !== 'practice' && seekClock() == null; }
function botsOk() { return modeSwapOk() && NET.mode !== 'ranked'; }
function botsRect(L) {
  const l = L.x + RM_HEAD_W, r = L.x + L.w - RM_HEAD_W, w = Math.max(RM_HEAD_H, Math.min(RM_BOTS_W, r - l - 8));
  return { x: l + ((r - l - w) >> 1), y: RM_HEAD_Y, w, h: RM_HEAD_H };
}
function botsListRects(L) { const b = botsRect(L); return AI_LEVELS.map((_, k) => ({ k, x: b.x, y: b.y + b.h + 1 + k * RM_LIST_H, w: b.w, h: RM_LIST_H })); }
function botsSet(k) {
  const m = state.menu;
  m.botsOpen = false;
  if (!botsOk() || !AI_LEVELS[k]) { SFX.deny(); return; }
  setAiLevel(k); // js/ui/menu.js
  netHostRoom();
  SFX.pickup();
}
function partySize() { return roomSide(player.team).filter(isHuman).length; }
// RANKED's bots: a level off the people's average rating (both parties' when two met), a band either side of the start
function rankLevel() {
  const rs = players.filter(isHuman).map((p) => NET.ranks[p.id] || PROFILE.RANK_START);
  const avg = rs.reduce((s, r) => s + r, 0) / Math.max(1, rs.length);
  return Math.max(0, Math.min(AI_LEVELS.length - 1, 1 + Math.floor((avg - PROFILE.RANK_START) / RANK_BAND + 0.5)));
}
// a ranked match's ending on this screen: the profile's rating moves (endMatch, js/sim/player.js)
function rankResult(won) { if (NET.mode === 'ranked') PROFILE.addRank(won ? RANK_STEP : -RANK_STEP); }

// FIND MATCH: every friend READY, then the party looks for another
// (seekStart, js/ui/matchmaking.js; a second press stops it), and then bots
// into every empty seat and everyone on to the hero select. RANKED pins the
// bots' level (NET.botLv, read by aiProfile, js/ai/ai-skill.js); QUICKPLAY
// leaves it the leader's.
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
  if (!seekStart()) partyStart(); // QUICKPLAY and RANKED look for another party first (js/ui/matchmaking.js)
}
// the match is on: every empty seat a bot, the party on to the hero select
function partyStart() {
  for (const p of players) if (!isHuman(p)) p.control = 'ai';
  NET.botLv = NET.mode === 'ranked' ? rankLevel() : null;
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
  const seed = r.data && +r.data.seed;
  // a party already on the practice field: this page follows it there
  if (r.data && +r.data.practice && !PRACTICE) { location.search = '?practice=1&join=' + r.room + '&back=1' + (netSteam() ? '&transport=steam' : ''); return; }
  if (seed && seed !== SEED) { location.search = '?seed=' + seed + '&join=' + r.room + (netSteam() ? '&transport=steam' : ''); return; }
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
  updateSeek(dt); // the leader's FIND MATCH looking for another party (js/ui/matchmaking.js)
  if (m.codeShake > 0) m.codeShake = Math.max(0, m.codeShake - dt);
  if (m.modeFx > 0) m.modeFx = Math.max(0, m.modeFx - dt);
  // a code being looked for: joined the moment the list names it, a rattle when it never does
  if (m.seek) {
    const r = m.rooms.find((q) => seekMatch(q, m.seek.code));
    if (r) joinRoom(r);
    else if ((m.seek.t -= dt) <= 0) { m.seek = null; roomsFeedClose(); m.codeShake = NAME_SHAKE_T; SFX.deny(); if (m.joining) partyGiveUp(); }
  }
  // a join answered: the party's seats on a welcome, our own party again on a refusal
  if ((m.screen === 'room' || PRACTICE) && NET.role === 'client' && m.joining) {
    if (NET.welcomed) { m.joining = false; m.joinWait = 0; m.codeOn = false; m.code = ''; if (!PRACTICE) beginRoom(); }
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
// a join that never landed: our own party again on the title, or the field
// alone on the practice page
function partyGiveUp() {
  if (homeParty) { crossHome(); return; } // a party that crossed to meet another and was turned away: home (js/ui/matchmaking.js)
  if (PRACTICE) { NET.mode = null; return; }
  beginParty(NET.mode || 'quick');
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
// the screen laid out, League's party lobby: two plates at the head, the
// mode's (left) and, while you are a party of one, JOIN's (right); your
// side's five seats in a row with you in the middle and the others filling
// outward; at the foot the party's one button with the X that leaves
// attached before it, the chat in the bottom-left corner and INVITE in the
// bottom-right, both as tall as the button. The social column takes the
// right edge (js/ui/friends.js).
function roomLayout() {
  const mw = VIEW_W - SOCIAL_W, x = 24, w = mw - 48;
  const side = roomSide(player ? player.team : 0), n = side.length, mid = n >> 1;
  const at = [mid]; // the positions, nearest the middle first
  for (let d = 1; at.length < n; d++) { if (mid - d >= 0) at.push(mid - d); if (mid + d < n && at.length < n) at.push(mid + d); }
  const order = side.filter((p) => p === player).concat(side.filter((p) => p !== player));
  const sx = Math.round((mw - n * RS_W - (n - 1) * RS_GAP) / 2);
  const seats = order.map((p, i) => ({ x: sx + at[i] * (RS_W + RS_GAP), y: RS_TOP, w: RS_W, h: RS_H, p, k: side.indexOf(p) })).sort((a, b) => a.x - b.x);
  const clock = seekClock(), find = clock != null ? seekText(clock) : 'FIND MATCH'; // looking: the word is the clock, and a press stops it
  const label = NET.isClient ? 'READY' : NET.mode === 'practice' ? 'START' : find;
  const gx = Math.round((mw - RM_X_W - RM_BTN_W + 1) / 2), by = VIEW_H - RM_FOOT;
  const leave = { x: gx, y: by, w: RM_X_W, h: RM_BTN_H }, go = { x: gx + RM_X_W - 1, y: by, w: RM_BTN_W, h: RM_BTN_H, label };
  const talk = { x, w: RM_SIDE_W, ty: by, th: RM_BTN_H, cw: (w >> 1) - 8 };
  const invite = { x: x + w - RM_SIDE_W, y: by, w: RM_SIDE_W, h: RM_BTN_H };
  const box = { x: x + w - RM_HEAD_W, y: RM_HEAD_Y, w: RM_HEAD_W, h: RM_HEAD_H };
  return { x, w, seats, leave, go, talk, invite, box };
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
// the party's code as it sits under your name in the social column: a relay room's, or the one a Steam
// lobby carries in its data (a guest is told it with the roster)
function roomCode() {
  if (NET.isClient) return NET.code || '';
  const T = NET.transport, c = String((T && (T.code || T.room)) || '');
  return c.length === RM_CODE_N ? c : '';
}
function roomHit() {
  const m = state.menu, L = roomLayout();
  if (m.modeOpen) { for (const r of modeListRects(L)) if (inRect(r)) return { kind: 'modeItem', k: r.k }; }
  if (m.botsOpen) { for (const r of botsListRects(L)) if (inRect(r)) return { kind: 'botsItem', k: r.k }; }
  if (inRect(L.leave, 1)) return { kind: 'leave' };
  if (inRect(L.go, 1)) return { kind: 'go' };
  if (inRect(L.invite, 1)) return { kind: 'invite' };
  if (modeSwapOk() && inRect(modeRect(L), 3)) return { kind: 'mode' };
  if (botsShown() && botsOk() && inRect(botsRect(L), 3)) return { kind: 'bots' };
  const cr = socialCodeRect(); // the social column (js/ui/friends.js): your code at its head, the friends under it
  if (cr && inRect(cr, 3)) return { kind: 'code' };
  if (codeBoxShown() && inRect(L.box, 2)) return { kind: 'box' };
  const fh = friendsHit(L);
  if (fh) return fh;
  if (inRect(talkLayout(L.talk), 2)) return { kind: 'talk' };
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
function seatInvite() { if (netSteam() && NET.transport && NET.transport.lobbyId) roomInvite(); else roomCopy(); }
// INVITE (the foot's right plate, an empty seat's +): while a seat stands empty
function roomInviteOk() { return seatsOpen() && roomSide(player.team).some((p) => p.control === 'none'); }
function roomGo(label) {
  if (label === 'READY') { netReady(!NET.ready.has(localId)); SFX.place(); }
  else if (label === 'START') partyPractice();
  else partyFind(); // FIND MATCH, or the clock that stops the looking
}
function roomDo(h) {
  const m = state.menu;
  if (!h) return;
  if (h.kind === 'code') { roomCopy(); return; }
  if (h.kind === 'bots') { m.botsOpen = !m.botsOpen; m.modeOpen = false; m.botsSel = settings.aiLevel | 0; SFX.pickup(); return; }
  if (h.kind === 'botsItem') { botsSet(h.k); return; }
  if (h.kind === 'mode') { m.botsOpen = false; m.modeOpen = !m.modeOpen; m.modeSel = Math.max(0, Object.keys(PARTY_MODES).indexOf(NET.mode)); SFX.pickup(); return; }
  if (h.kind === 'modeItem') { modeSet(h.k); return; }
  if (h.kind === 'box') { m.codeOn = true; m.code = ''; SFX.pickup(); return; }
  if (h.kind === 'talk') { talkOpen(); return; }
  if (h.kind === 'friend') { if (h.f.head) friendHeadDo(); else friendDo(h.f); return; }
  if (h.kind === 'leave') { leaveRoom(); return; }
  if (h.kind === 'invite') { if (roomInviteOk()) seatInvite(); else SFX.deny(); return; }
  if (h.kind === 'go') { if (m.joining) SFX.deny(); else roomGo(roomLayout().go.label); return; }
  if (h.act === 'invite') seatInvite();
  else if (h.act === 'kick') { seatKick(h.id); SFX.deny(); }
}
function roomClick() {
  const m = state.menu;
  if (m.roomsT < 1) return;
  const h = roomHit();
  if (!h || h.kind !== 'talk') m.talkOn = false; // a click anywhere else puts the chat line away
  if (!h || h.kind !== 'box') m.codeOn = false;
  if (m.modeOpen && (!h || (h.kind !== 'modeItem' && h.kind !== 'mode'))) { m.modeOpen = false; SFX.pickup(); return; } // a click off the open list only shuts it
  if (m.botsOpen && (!h || (h.kind !== 'botsItem' && h.kind !== 'bots'))) { m.botsOpen = false; SFX.pickup(); return; }
  roomDo(h);
}
// the keys walk a cursor along the five seats (left and right; right off the
// last one enters the friends' column), up onto the mode's name and down
// onto the foot (the X, the button, INVITE); Enter does what a click there
// would. The code's slots, while lit, take every key; the modes' list,
// while open, takes up, down, Enter and Esc
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
  const d = moveDir(k);
  if (m.modeOpen) {
    const keys = Object.keys(PARTY_MODES);
    if (d === 'up' || d === 'down') { m.modeSel = (m.modeSel + (d === 'down' ? 1 : keys.length - 1)) % keys.length; SFX.pickup(); }
    else if (k === 'enter' || k === ' ') modeSet(keys[m.modeSel]);
    else if (k === 'escape' || k === 'backspace') { m.modeOpen = false; SFX.pickup(); }
    return;
  }
  if (m.botsOpen) {
    const n = AI_LEVELS.length;
    if (d === 'up' || d === 'down') { m.botsSel = (m.botsSel + (d === 'down' ? 1 : n - 1)) % n; SFX.pickup(); }
    else if (k === 'enter' || k === ' ') botsSet(m.botsSel);
    else if (k === 'escape' || k === 'backspace') { m.botsOpen = false; SFX.pickup(); }
    return;
  }
  if (m.fcur >= 0 && friendsKey(k, L)) return; // the keys in the friends' column (js/ui/friends.js)
  if (k === 'escape' || k === 'backspace') { leaveRoom(); return; }
  const at = L.seats.findIndex((s) => s.p.id === m.rseat), mine = L.seats.findIndex((s) => s.p === player);
  if (m.rseat === RS_HEAD || m.rseat === RS_BOTS) { // the cursor on the mode's name or the bots' level: Enter opens its list
    if (k === 'enter' || k === ' ') roomDo({ kind: m.rseat === RS_HEAD ? 'mode' : 'bots' });
    else if (d === 'right' && m.rseat === RS_HEAD && botsShown() && botsOk()) { m.rseat = RS_BOTS; SFX.pickup(); }
    else if (d === 'left' && m.rseat === RS_BOTS) { m.rseat = RS_HEAD; SFX.pickup(); }
    else if (d === 'down') { m.rseat = L.seats[mine].p.id; SFX.pickup(); }
    return;
  }
  if (at >= 0) { // on a seat
    if (d === 'left' || d === 'right') {
      const to = at + (d === 'right' ? 1 : -1);
      if (to >= L.seats.length && friendsLayout(L)) m.fcur = 0;
      else if (to >= 0 && to < L.seats.length) m.rseat = L.seats[to].p.id;
      SFX.pickup();
    } else if (d === 'up' && modeSwapOk()) { m.rseat = RS_HEAD; SFX.pickup(); }
    else if (d === 'down') { m.rseat = -1; m.rword = 1; SFX.pickup(); }
    else if (k === 'enter' || k === ' ') { const act = seatAct(L.seats[at]); if (act) roomDo({ kind: 'seat', id: m.rseat, act }); else SFX.deny(); }
    return;
  }
  // on the foot: the X (rword 0), the button (1) and INVITE (2)
  if (d === 'left' || d === 'right') { m.rword = Math.max(0, Math.min(2, m.rword + (d === 'right' ? 1 : -1))); SFX.pickup(); }
  else if (d === 'up') { m.rseat = L.seats[mine].p.id; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') roomDo({ kind: ['leave', 'go', 'invite'][m.rword] });
}
function roomAllReady() { return players.every((p) => p.control !== 'remote' || NET.ready.has(p.id)); }
// the bots' level the room plays: RANKED's pinned one, the leader's own setting, a guest's copy of it
function roomLevel() { return NET.isClient ? NET.aiLevel : NET.botLv != null ? NET.botLv : NET.mode === 'ranked' ? rankLevel() : settings.aiLevel | 0; }

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
  if (homeParty) return crossHomeUrl(); // a party that crossed over for this match goes back to its own (js/ui/matchmaking.js)
  if (!NET.mode) return null; // a page that never opened a party: the title, as it was
  const base = location.pathname + '?back=1', steam = netSteam() ? '&transport=steam' : '';
  const code = roomCode();
  if (NET.isHost) {
    const seed = NET.nextSeed || rollSeed();
    if (NET.peers.size) NET.transport.send('*', { t: 'rematch', seed });
    const seats = {};
    for (const pr of NET.peers.values()) if (!pr.cross) seats[pr.uid] = pr.slot; // the rival party goes home
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: NET.mode, seats })); } catch (e) { }
    return base + '&seed=' + seed + '&net=host' + steam + (code ? (steam ? '&code=' : '&room=') + code : '');
  }
  if (NET.rematch && NET.rematch.room) return base + '&seed=' + NET.rematch.seed + '&join=' + NET.rematch.room + steam;
  return null;
}
// the leader's, every step: the first step of an ended match picks the next valley
function rematchOffer() {
  if (NET.nextSeed || !(state.over === 'won' || state.over === 'lost') || !roomCode()) return;
  NET.nextSeed = rollSeed();
  NET.transport.send('*', { t: 'rematch', seed: NET.nextSeed });
}
function rematchHeard(msg) {
  NET.rematch = { seed: msg.seed | 0, room: roomCode() };
  if (PRACTICE) toLobby(); // the leader left the field: the party follows it back (js/ui/screens.js)
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
  NET.mode = (c && PARTY_MODES[c.mode]) ? c.mode : 'quick';
  rematchCarry = { seats: (c && c.seats) || {} };
  beginRoom();
}
function rematchBootJoin() {
  // a party crossing to meet another joins a room that is already up: a few tries, then home (js/ui/matchmaking.js)
  if (/[?&]back=1/.test(location.search)) state.menu.joinWait = CROSS ? MATCH_JOIN : REMATCH_WAIT;
}

// ------------------------------------------------------------ the practice field
// PRACTICE TOOL is a party too: the leader's START (every friend READY)
// takes the whole party onto the field (?practice=1). The leader's page
// reloads hosting on the party's code; each guest is told (`practice`) and
// reloads joining it, trying the code while the leader's page comes up. On
// the field friends join at any time and stand on the spawn (practiceSeat,
// js/sim/practice.js). The leader's LEAVE takes everyone back to the party on
// the title (rematchUrl, rematchHeard); a guest's LEAVE takes only them to the title.
function practiceUrl(host) {
  const code = roomCode(), steam = netSteam() ? '&transport=steam' : '';
  if (host) return location.pathname + '?practice=1&net=host&back=1' + steam + (code ? (steam ? '&code=' : '&room=') + code : '');
  return location.pathname + '?practice=1&join=' + code + '&back=1' + steam;
}
function practiceGo(url) {
  if (state.fade) return;
  SFX.dodge();
  SFX.music.stop(0.45);
  state.fade = { a: 0, to: 1, spd: 1 / 0.55, color: '#f4f7ff', then: () => {
    try { sessionStorage.setItem('softfall.reroll', '1'); } catch (e) { }
    location.href = url;
  } };
}
function partyPractice() {
  const m = state.menu;
  if (NET.role !== 'host' || !seatsOpen()) return;
  if (!roomAllReady()) {
    for (const p of players) if (p.control === 'remote' && !NET.ready.has(p.id)) m.cardFx[p.id] = 0.6;
    SFX.deny();
    return;
  }
  m.pressT = 0.12;
  const seats = {};
  for (const pr of NET.peers.values()) seats[pr.uid] = pr.slot;
  try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: 'practice', seats })); } catch (e) { }
  if (NET.peers.size) NET.transport.send('*', { t: 'practice' });
  practiceGo(practiceUrl(true));
}
// a guest told the party is going: after it
function practiceHeard() { if (!PRACTICE && roomCode()) practiceGo(practiceUrl(false)); }
// the field's two boots (js/app/boot.js): the leader's page hosting the party
// again, a guest's page joining it
function practiceBootHost() {
  if (NET.role !== 'host' || !/[?&]back=1/.test(location.search)) return;
  let c = null;
  try { c = JSON.parse(sessionStorage.getItem(REMATCH_KEY) || 'null'); sessionStorage.removeItem(REMATCH_KEY); } catch (e) { }
  NET.mode = 'practice';
  rematchCarry = { seats: (c && c.seats) || {} };
}
function practiceBootJoin(code) {
  const m = state.menu;
  NET.mode = 'practice'; m.joining = true;
  if (netSteam() && code.length === RM_CODE_N) { partySeek(code, REMATCH_WAIT); return; }
  netJoin(code);
  rematchBootJoin();
}

// ------------------------------------------------------------ the pixels
function drawXMark(x, y, col) { ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + 4 - i, y + i, 1, 1); } }
function drawPlusMark(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 2, 5, 1); ctx.fillRect(x + 2, y, 1, 5); }
// a right-pointing step, 6x10: the head's 2x grain
function drawNextMark(x, y, col) { ctx.fillStyle = col; for (let i = 0; i < 3; i++) ctx.fillRect(x + 2 * i, y + 2 * i, 2, 10 - 4 * i); }
function drawCrown(x, y) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1); ctx.fillRect(x, y + 1, 5, 1); }
// a word at the foot: white, gold under the pointer or the keys, lifted a px
// The foot, League's: one button that says what the party does next (FIND
// MATCH, its clock while looking, START, a guest's READY - green once said),
// dim until every friend is ready, and the X that leaves attached before it
function drawRoomFoot(L, hot, dim, col) {
  const g = L.go, x = L.leave;
  ctx.fillStyle = hot === 'go' && !dim ? SC_LBL : SC_EDGE; ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = hot === 'go' && !dim ? SC_HOT : SC_PLATE; ctx.fillRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
  const tw = pixelTextWidth(g.label, MENU_TXT_SCALE);
  drawPixelText(ctx, g.label, g.x + ((g.w - tw) >> 1), g.y + ((g.h - 7 * MENU_TXT_SCALE) >> 1) + 1, dim ? SC_DIM : col || (hot === 'go' ? '#ffd95c' : SC_LIT), MENU_TXT_SCALE);
  ctx.fillStyle = hot === 'leave' ? SC_LBL : SC_EDGE; ctx.fillRect(x.x, x.y, x.w, x.h);
  ctx.fillStyle = hot === 'leave' ? SC_HOT : SC_PLATE; ctx.fillRect(x.x + 1, x.y + 1, x.w - 2, x.h - 2);
  drawXMark(x.x + ((x.w - 5) >> 1), x.y + ((x.h - 5) >> 1), hot === 'leave' ? RM_BAD : SC_LBL);
}
// INVITE, the foot's right plate (the chat's mirror): the person-plus and
// the word; a click opens Steam's invite on this lobby, or copies the code.
// Over it, the friends invited from the column, newest lowest: a green tick
// once they are in the party, the dim letter while the invite stands.
function drawRoomInvite(L, hot) {
  const r = L.invite, ok = roomInviteOk();
  ctx.fillStyle = hot && ok ? SC_LBL : SC_EDGE; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = hot && ok ? SC_HOT : SC_PLATE; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const word = 'INVITE', ww = pixelTextWidth(word) + 13, wx = r.x + ((r.w - ww) >> 1), col = !ok ? SC_DIM : hot ? '#ffd95c' : SC_TXT;
  frBmp(wx, r.y + 7, FR_ICON.add, ok ? (hot ? '#ffd95c' : SC_GOLD) : SC_DIM);
  drawPixelText(ctx, word, wx + 13, r.y + 8, col, 1);
  const names = FRIENDS.invites.slice(-RM_INVITED), inParty = new Set(roomSide(player.team).filter(isHuman).map((p) => p.name));
  names.forEach((f, i) => {
    const y = r.y - (names.length - i) * TALK_PITCH - 2, nm = talkClean(f.name).slice(0, 16), nx = r.x + r.w - 2 - pixelTextWidth(nm);
    const there = inParty.has(nm);
    drawPixelText(ctx, nm, nx, y, there ? SC_TXT : SC_DIM, 1);
    if (there) drawTick(nx - 8, y, RM_OK); else frBmp(nx - 10, y - 1, FR_ICON.invite, SC_EDGE);
  });
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
// The slots a friend's code goes in: JOIN and four on a plate, the letters
// typed so far in them, a gold rim and a blinking caret while it is lit, a
// rattle on a code no room answers to.
function drawCodeBox(r, m, now, hot) {
  const dx = m.codeShake > 0 ? Math.round(Math.sin(m.codeShake * 60) * 2 * (m.codeShake / NAME_SHAKE_T)) : 0;
  const x = r.x + dx, y = r.y;
  ctx.fillStyle = m.codeOn ? '#c89a3c' : hot ? SC_LBL : SC_EDGE; ctx.fillRect(x, y, r.w, r.h);
  ctx.fillStyle = m.codeOn ? SC_YOU : SC_PLATE; ctx.fillRect(x + 1, y + 1, r.w - 2, r.h - 2);
  const pitch = 14, word = 'JOIN', ww = pixelTextWidth(word, 2) + 12, x0 = x + ((r.w - pitch * RM_CODE_N + 6 + ww) >> 1), ty = y + ((r.h - 10) >> 1);
  drawPixelText(ctx, word, x0 - ww, ty, m.codeOn || hot ? SC_TXT : SC_DIM, 2);
  for (let i = 0; i < RM_CODE_N; i++) {
    const cx = x0 + i * pitch, ch = m.code[i];
    if (ch) drawPixelText(ctx, ch, cx, ty, m.codeShake > 0 ? '#e0524f' : SC_GOLD, 2);
    else { ctx.fillStyle = i === m.code.length && m.codeOn && Math.floor(now * 2.5) % 2 ? SC_GOLD : hot ? SC_LBL : SC_DIM; ctx.fillRect(cx, ty + 9, 8, 1); }
  }
}
// One seat, a card in League's row: the side's paint along its top, the
// portrait, the name and the hero under it, in RANKED the person's rating, a crown
// over the leader's portrait, a friend's READY tick and ping bars at its
// foot. Yours wears the gold rim; a seat that just changed hands flashes
// (cardFx, updateTitle). An empty seat is a dotted well with the gold + that
// invites, with no card. Under the pointer it lights, and the leader's hand on a friend
// shows the X in its corner.
function drawRoomSeat(s, act, flash) {
  const p = s.p, me = p === player, x = s.x, y = s.y, w = s.w, h = s.h;
  const fs = RS_FACE, fx = x + ((w - fs) >> 1), fy = y + 20;
  if (!isHuman(p)) { // an empty seat: no card, a dotted well where the portrait would be, the invite's + in it
    if (act || flash) { ctx.fillStyle = flash ? '#3a3e46' : SC_HOT; ctx.fillRect(fx, fy, fs, fs); }
    ctx.fillStyle = act ? SC_LBL : SC_EDGE;
    for (let i = 0; i < fs; i += 2) { ctx.fillRect(fx + i, fy, 1, 1); ctx.fillRect(fx + i, fy + fs - 1, 1, 1); ctx.fillRect(fx, fy + i, 1, 1); ctx.fillRect(fx + fs - 1, fy + i, 1, 1); }
    if (seatsOpen()) drawPlusMark(fx + ((fs - 5) >> 1), fy + ((fs - 5) >> 1), act ? '#ffd95c' : SC_GOLD);
    return;
  }
  ctx.fillStyle = flash ? '#3a3e46' : act ? SC_HOT : me ? SC_YOU : SC_PLATE; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TEAMS[skin(p.team)].mark; ctx.fillRect(x, y, w, 2);
  if (me) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(x, y + 2, 1, h - 2); ctx.fillRect(x + w - 1, y + 2, 1, h - 2); ctx.fillRect(x, y + h - 1, w, 1); }
  drawScoreFace(fx, fy, fs, { id: p.id, you: me, team: p.team, level: p.level || 1, sc: 3 });
  if (p === roomHost()) drawCrown(fx + (fs >> 1) - 2, fy - 5);
  let nm = p.name;
  while (nm.length > 1 && pixelTextWidth(nm) > w - 6) nm = nm.slice(0, -1);
  const ny = fy + fs + 9, hero = CLASSES[p.cls] ? CLASSES[p.cls].name : '';
  drawPixelText(ctx, nm, x + ((w - pixelTextWidth(nm)) >> 1), ny, me ? SC_GOLD : SC_LIT, 1);
  if (hero) drawPixelText(ctx, hero, x + ((w - pixelTextWidth(hero)) >> 1), ny + 10, SC_DIM, 1); // the hero they last locked in
  if (NET.mode === 'ranked') { const r = String(NET.ranks[p.id] || PROFILE.RANK_START); drawPixelText(ctx, r, x + ((w - pixelTextWidth(r)) >> 1), ny + 20, SC_LBL, 1); }
  if (p !== roomHost()) { // a guest: READY's tick (the leader's word is FIND MATCH, so it wears none) and the link to the leader
    const ry = y + h - 14, ready = NET.ready.has(p.id), bx = x + ((w - (ready ? 18 : 8)) >> 1);
    if (ready) drawTick(bx, ry + 2, RM_OK);
    drawPingBars(bx + (ready ? 10 : 0), ry, NET.pings[p.id]);
  }
  if (act === 'kick') drawXMark(x + w - 10, y + 6, '#e0524f');
}

function renderRoom(now, a) {
  const m = state.menu, L = roomLayout();
  const hit = m.roomsT >= 1 ? roomHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(13,14,17,' + RM_WASH + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); // the snowy valley soft behind it
  // the mode's name; the leader's lights under the pointer, and a click opens the list of modes
  const headHot = hit ? hit.kind === 'mode' : (m.rkeys && m.rseat === RS_HEAD && modeSwapOk()) || m.modeOpen, mr = modeRect(L);
  ctx.fillStyle = headHot ? SC_LBL : SC_EDGE; ctx.fillRect(mr.x, mr.y, mr.w, mr.h);
  ctx.fillStyle = headHot ? SC_HOT : SC_PLATE; ctx.fillRect(mr.x + 1, mr.y + 1, mr.w - 2, mr.h - 2);
  drawPixelText(ctx, partyName(), mr.x + ((mr.w - pixelTextWidth(partyName(), 2)) >> 1), mr.y + 6, m.modeFx > 0 ? SC_GOLD : headHot ? '#ffd95c' : SC_LIT, 2);
  const clock = seekClock(); // looking for a party: a gold clock after the plate, on every screen
  if (clock != null) drawPixelText(ctx, seekText(clock), mr.x + mr.w + 8, mr.y + 6, SC_GOLD, 2);
  if (botsShown()) drawRoomBots(L, hit ? hit.kind === 'bots' : (m.rkeys && m.rseat === RS_BOTS) || m.botsOpen);
  // alone, JOIN and the slots a friend's code goes in, right of the head; gold while its code is looked for
  if (codeBoxShown() || m.joining) drawCodeBox(L.box, m.joining || m.seek ? Object.assign({}, m, { codeOn: true }) : m, now, hit && hit.kind === 'box');
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 46, L.w, 1);
  if (!m.joining) for (const s of L.seats) {
    let act = hit && hit.kind === 'seat' && hit.id === s.p.id ? hit.act : null;
    if (!act && m.rseat === s.p.id && !hit) act = seatAct(s) || 'none'; // the keys' cursor lights the seat too
    drawRoomSeat(s, act === 'none' ? null : act, m.cardFx && m.cardFx[s.p.id] > 0);
    if (m.rseat === s.p.id && !hit && isHuman(s.p)) { ctx.fillStyle = SC_GOLD; ctx.fillRect(s.x, s.y, s.w, 2); }
  }
  drawTalk(L.talk, now, hit && hit.kind === 'talk');
  drawRoomInvite(L, hit ? hit.kind === 'invite' : m.rkeys && m.rseat === -1 && m.rword === 2);
  // FIND MATCH (or START) is dim until every friend is READY; a guest's READY is green once said
  const g = L.go.label, seeking = /^\d+:\d\d$/.test(g);
  const footHot = hit ? (hit.kind === 'go' || hit.kind === 'leave' ? hit.kind : null) : m.rkeys && m.rseat === -1 ? ['leave', 'go', null][m.rword] : null;
  drawRoomFoot(L, footHot, ((g === 'FIND MATCH' || g === 'START') && !roomAllReady()) || m.joining,
    g === 'READY' && NET.ready.has(localId) ? RM_OK : seeking ? (footHot === 'go' ? RM_BAD : SC_GOLD) : null);
  drawSocial(L, now, hit); // you, your code and your friends down the right edge (js/ui/friends.js)
  if (m.modeOpen) { // the modes' list, over the seats
    const rs = modeListRects(L), keys = Object.keys(PARTY_MODES), last = rs[rs.length - 1];
    ctx.fillStyle = SC_EDGE; ctx.fillRect(rs[0].x, rs[0].y - 1, RM_HEAD_W, last.y + last.h - rs[0].y + 2);
    rs.forEach((r, i) => {
      const hot = hit ? hit.kind === 'modeItem' && hit.k === r.k : m.rkeys && m.modeSel === i;
      ctx.fillStyle = hot ? SC_HOT : SC_PLATE; ctx.fillRect(r.x + 1, r.y, r.w - 2, r.h);
      drawPixelText(ctx, PARTY_MODES[keys[i]], r.x + ((r.w - pixelTextWidth(PARTY_MODES[keys[i]])) >> 1), r.y + 4, r.k === NET.mode ? SC_GOLD : hot ? SC_LIT : SC_TXT, 1);
    });
  }
  if (m.botsOpen) { // the levels' list, over the seats
    const rs = botsListRects(L), last = rs[rs.length - 1], lv = roomLevel();
    ctx.fillStyle = SC_EDGE; ctx.fillRect(rs[0].x, rs[0].y - 1, rs[0].w, last.y + last.h - rs[0].y + 2);
    for (const r of rs) {
      const hot = hit ? hit.kind === 'botsItem' && hit.k === r.k : m.rkeys && m.botsSel === r.k;
      ctx.fillStyle = hot ? SC_HOT : SC_PLATE; ctx.fillRect(r.x + 1, r.y, r.w - 2, r.h);
      const nm = AI_LEVELS[r.k].name, bw = botBarsW(false) + 4, gx = r.x + ((r.w - bw - pixelTextWidth(nm)) >> 1);
      drawBotBars(gx, r.y + 3, r.k, false);
      drawPixelText(ctx, nm, gx + bw, r.y + 4, r.k === lv ? SC_GOLD : hot ? SC_LIT : SC_TXT, 1);
    }
  }
  ctx.globalAlpha = 1;
}
// a level's grade: a rising bar per level standing on y + H (big: the
// head's, 10 tall; else the list's, 6), as many lit as the level is hard, in
// its colour - green, amber, red, violet
const BOT_COL = ['#7fd88a', '#e8b04a', '#e0524f', '#b77ce8'];
function drawBotBars(x, y, k, big) {
  const n = AI_LEVELS.length, w = big ? 3 : 2, g = big ? 2 : 1, H = big ? 10 : 6, col = BOT_COL[Math.min(BOT_COL.length - 1, k)];
  for (let i = 0; i < n; i++) { const h = Math.round(H * (i + 1) / n); ctx.fillStyle = i <= k ? col : SC_EDGE; ctx.fillRect(x + i * (w + g), y + H - h, w, h); }
}
function botBarsW(big) { return AI_LEVELS.length * (big ? 5 : 3) - (big ? 2 : 1); }
// the head's middle plate: the bots' level, lit under the leader's hand
function drawRoomBots(L, hot) {
  const r = botsRect(L), lv = roomLevel(), ok = botsOk(), nm = AI_LEVELS[lv].name;
  hot = hot && ok;
  ctx.fillStyle = hot ? SC_LBL : SC_EDGE; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = hot ? SC_HOT : SC_PLATE; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  const bw = botBarsW(true) + 5, sc = AI_LEVELS.every((l) => bw + pixelTextWidth(l.name, 2) <= r.w - 10) ? 2 : 1, tw = pixelTextWidth(nm, sc), named = bw + tw <= r.w - 8; // one size for every level: a change never jumps
  const x0 = r.x + ((r.w - (named ? bw + tw : bw - 5)) >> 1);
  drawBotBars(x0, r.y + ((r.h - 10) >> 1), lv, true);
  if (named) drawPixelText(ctx, nm, x0 + bw, r.y + ((r.h - 5 * sc) >> 1), hot ? '#ffd95c' : ok ? SC_LIT : SC_TXT, sc);
}

// In a match, a client whose socket is down: a red pip blinking top-centre
// while the transport redials, and nothing at all while the link is good
function drawNetLink(now) {
  if (!NET.isClient || (NET.transport && NET.transport.open && NET.synced)) return;
  drawRelayPip(Math.round(VIEW_W / 2) - 2, 3, false, now);
}
