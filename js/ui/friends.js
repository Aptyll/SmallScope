// ------------------------------------------------------------ friends
// The party lobby's right-hand column under the wrapper with Steam up: your
// Steam friends, read every FR_POLL s off the bridge (desktop/steam-friends.js),
// and the people you played with. Colour says where each one is - green in
// Softfall, blue online, amber away, grey offline (folded into one count
// row a click opens) - and the far end of a row says what a click does:
// the gold step JOINS a friend's open party (their lobby, the same reload a
// Steam invite takes: steamJoinRequested, js/ui/roomtalk.js), the letter
// INVITES an online friend to yours (shown under the pointer; Steam's own
// invite plus a card on their screen), a green tick is an invite just sent,
// and the gold person-plus on a played-with row opens Steam's add-friend
// page (a game cannot send a friend request itself). The person-plus at the
// head opens Steam's friends list. A friend in a match has a bare row. A friend's patch that is not yours shows
// in red where their party's count would be, and no step: that join would
// be refused. The keys reach the column from a seat with right, walk it with
// up and down, and leave it with left.
//
// THE CARD: a friend's invite while this screen is on the title - their
// name, their party, JOIN and a cross - bottom right, for FR_CARD_T s.
//
// PRESENCE: what this screen is doing goes into Steam's rich presence
// (friendsPresence): the `status` line Steam's own friends list shows, its
// Join Game (`connect`) while a party is open, and the sf_* keys the column
// above reads on a friend's row. A minute into a match with people, the
// lobby's other members are marked played with (friendsPlayed).
//
// No bridge, no friends call, or a bridge that answers `ok: false` (koffi
// missing): FRIENDS.on stays false, nothing here draws, and the party's
// code and INVITE work as they always have.
const FR_POLL = 3;          // s between reads of the list while the title is up
const FR_ROW = 14, FR_ROW2 = 21, FR_GAP = 2; // a row, a row with its party under the name, between rows
const FR_HEAD = 16;         // the column's head: the people mark, the counts, the add-friend mark
const FR_LEFT = 18;         // px between the seats and the column
const FR_MIN_W = 110;       // narrower than this and the column is not drawn
const FR_SENT = 30;         // s an invite shows its tick and cannot be sent again
const FR_CARD_T = 40;       // s a friend's invite card stays
const FR_CARD_W = 168, FR_CARD_H = 22;
const FR_PLAYED_T = 60;     // s into a match with people before they count as played with
const FR_PARTY_MAX = 5;     // seats a party has (one side)
const FR_COL = { game: '#7fd88a', on: '#6fa8dc', away: '#e8b04a', off: '#4a4e56' };
const FR_ICON = {
  join: ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
  invite: ['#######', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#######'],
  sent: ['....#', '...#.', '#.#..', '.#...'],
  add: ['.##.....', '#..#....', '#..#..#.', '.##..###', '......#.', '#..#....', '####....'],
  people: ['.##..##.', '#..##..#', '#..##..#', '.##..##.', '........', '###..###', '###..###'],
  fold: ['#####', '.###.', '..#..'],
  unfold: ['..#..', '.###.', '#####'],
  recent: ['..###..', '.#...#.', '#..#..#', '#..##.#', '#.....#', '.#...#.', '..###..'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
};
const FRIENDS = { on: false, list: [], recent: [], t: 0, busy: false, sent: {}, offOpen: false, scroll: 0, card: null, rp: '', played: false, playT: 0 };

function friendsBridge() { const b = window.steamBridge; return netSteam() && b && b.friends ? b : null; }
function friendsLobby() { const T = NET.transport; return netSteam() && T && T.open && T.lobbyId ? String(T.lobbyId) : ''; }
// 0 in Softfall, 1 online, 2 away (busy, away, snooze), 3 offline - Steam's persona states
function frGroup(f) { return f.game ? 0 : f.st === 1 || f.st >= 5 ? 1 : f.st ? 2 : 3; }
function frPatch(p) { return String(p || '?').replace(/^PATCH /, ''); }
function frColor(f) { return [FR_COL.game, FR_COL.on, FR_COL.away, FR_COL.off][frGroup(f)]; }

// every step, every mode: the card's and the ticks' clocks, the presence,
// the played-with mark, and on the title the list's poll
function friendsTick(dt) {
  const b = friendsBridge();
  if (!b) { FRIENDS.on = false; return; }
  if (FRIENDS.card && (FRIENDS.card.t -= dt) <= 0) FRIENDS.card = null;
  for (const id in FRIENDS.sent) if ((FRIENDS.sent[id] -= dt) <= 0) delete FRIENDS.sent[id];
  friendsPresence(b);
  friendsPlayed(b, dt);
  if (state.mode !== 'title' || FRIENDS.busy || (FRIENDS.t -= dt) > 0) return;
  FRIENDS.t = FR_POLL; FRIENDS.busy = true;
  b.friends().then((r) => {
    FRIENDS.busy = false;
    FRIENDS.on = !!(r && r.ok && Array.isArray(r.friends));
    if (!FRIENDS.on) return;
    FRIENDS.list = r.friends.slice().sort((a, c) => frGroup(a) - frGroup(c) || String(a.name).localeCompare(String(c.name)));
    FRIENDS.recent = (r.recent || []).map((q) => Object.assign({ recent: true }, q));
  }, () => { FRIENDS.busy = false; FRIENDS.on = false; });
}
function friendsPresence(b) {
  const lobby = friendsLobby(), inMatch = state.mode !== 'title' && !PRACTICE;
  const room = !inMatch && NET.mode && state.menu.screen === 'room';
  const st = inMatch ? 'match' : PRACTICE ? 'practice' : room ? 'room' : 'menu', n = room ? partySize() : 0;
  const key = [st, lobby, NET.mode || '', n].join('|');
  if (key === FRIENDS.rp) return;
  FRIENDS.rp = key;
  const mode = PARTY_MODES[NET.mode] || PARTY_MODES.quick, word = mode.charAt(0) + mode.slice(1).toLowerCase();
  const status = st === 'match' ? 'In a match' : st === 'practice' ? 'Practice Tool' : st === 'room' ? word + ' party, ' + n + ' of ' + FR_PARTY_MAX : 'In the menus';
  b.presence({ status, connect: room && lobby ? '+connect_lobby ' + lobby : '', sf_lobby: room ? lobby : '', sf_mode: NET.mode || '', sf_n: String(n), sf_state: st, sf_patch: PATCH_TXT });
}
function friendsPlayed(b, dt) {
  if (FRIENDS.played || state.mode === 'title' || PRACTICE || !friendsLobby() || !players.some((p) => p.control === 'remote')) return;
  if ((FRIENDS.playT += dt) < FR_PLAYED_T) return;
  FRIENDS.played = true;
  b.playedWith(friendsLobby());
}

// what a click on row f does: 'join', 'invite', 'add', 'fold', or null ('sent' draws a tick and does nothing)
function friendAct(f) {
  if (f.fold) return 'fold';
  if (f.recent) return 'add';
  if (FRIENDS.sent[f.id]) return 'sent';
  const mine = friendsLobby();
  if (f.game && f.lobby && f.lobby === mine) return null; // already in your party
  if (f.game && f.lobby && f.state === 'room' && f.patch === PATCH_TXT && f.n < FR_PARTY_MAX) return 'join';
  if (f.game && (f.state === 'match' || (f.patch && f.patch !== PATCH_TXT))) return null; // busy, or a patch that could not join
  if (f.st && mine && seatsOpen() && partySize() < FR_PARTY_MAX) return 'invite';
  return null;
}
function friendDo(f) {
  const b = friendsBridge(), act = f && friendAct(f);
  if (!b || !act || act === 'sent') { SFX.deny(); return; }
  if (act === 'fold') { FRIENDS.offOpen = !FRIENDS.offOpen; SFX.pickup(); return; }
  if (act === 'add') { b.overlayUser('friendadd', f.id); SFX.place(); return; }
  if (act === 'join') { steamJoinRequested(f.lobby); return; }
  b.inviteFriend(friendsLobby(), f.id, { mode: NET.mode || 'quick', n: partySize(), patch: PATCH_TXT });
  FRIENDS.sent[f.id] = FR_SENT;
  SFX.place();
}

// ---- the column -----------------------------------------------------------
// the column beside the seats: its head, then every row that fits between
// the head and the chat, FRIENDS.scroll rows down
function friendsLayout(L) {
  if (!FRIENDS.on || !L.seats.length || state.menu.joining) return null;
  const x = L.seats[0].x + L.seats[0].w + FR_LEFT, w = L.x + L.w - x, y = RS_TOP;
  if (w < FR_MIN_W) return null;
  const bottom = talkLayout(L).top - 4;
  const off = FRIENDS.list.filter((f) => frGroup(f) === 3);
  const rows = FRIENDS.list.filter((f) => frGroup(f) < 3);
  if (off.length) rows.push({ fold: true, n: off.length });
  if (off.length && FRIENDS.offOpen) rows.push(...off);
  if (FRIENDS.recent.length) rows.push({ sep: true }, ...FRIENDS.recent);
  const H = (f) => (f.sep ? 11 : f.game && f.state === 'room' ? FR_ROW2 : f.fold ? 12 : FR_ROW);
  FRIENDS.scroll = Math.max(0, Math.min(FRIENDS.scroll, rows.length - 1));
  const out = [];
  let yy = y + FR_HEAD;
  for (let i = FRIENDS.scroll; i < rows.length; i++) {
    const h = H(rows[i]);
    if (yy + h > bottom) break;
    out.push({ x, y: yy, w, h, f: rows[i] });
    yy += h + FR_GAP;
  }
  return { x, y, w, bottom, rows: out, more: FRIENDS.scroll + out.length < rows.length, add: { x: x + w - 9, y: y + 1, w: 8, h: 7 } };
}
function friendsScrollBy(d) { FRIENDS.scroll = Math.max(0, FRIENDS.scroll + d); }
function friendsOver() { const F = state.menu.screen === 'room' ? friendsLayout(roomLayout()) : null; return !!F && mouse.x >= F.x && mouse.y >= F.y && mouse.y < F.bottom; }
function friendsHit(L) {
  const F = friendsLayout(L);
  if (!F) return null;
  if (inRect(F.add, 3)) return { kind: 'friend', f: { head: true } };
  for (const r of F.rows) if (!r.f.sep && inRect(r)) return { kind: 'friend', f: r.f };
  return null;
}
function friendHeadDo() { const b = friendsBridge(); if (b) { b.overlayFriends(); SFX.place(); } }
// the keys: right from a seat enters the column, up and down walk its rows, left goes back
function friendsKey(k, L) {
  const m = state.menu, F = friendsLayout(L), d = moveDir(k);
  if (!F || !F.rows.length) { m.fcur = -1; return false; }
  const rows = F.rows.filter((r) => !r.f.sep);
  const at = Math.max(0, Math.min(rows.length - 1, m.fcur));
  if (d === 'left' || k === 'escape') { m.fcur = -1; m.rseat = L.seats[0].p.id; SFX.pickup(); return true; }
  if (d === 'up' || d === 'down') {
    const to = at + (d === 'down' ? 1 : -1);
    if (to < 0 && FRIENDS.scroll > 0) friendsScrollBy(-1);
    else if (to >= rows.length && F.more) friendsScrollBy(1);
    else m.fcur = Math.max(0, Math.min(rows.length - 1, to));
    SFX.pickup();
    return true;
  }
  if (k === 'enter' || k === ' ') { friendDo(rows[at].f); return true; }
  return true;
}
function frBmp(x, y, rows, col) {
  ctx.fillStyle = col;
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
}
function drawFriends(L, hit) {
  const F = friendsLayout(L), m = state.menu;
  if (!F) return;
  const x = F.x, w = F.w;
  // the head: the people mark, how many friends are in Softfall (green) and online (blue), add-friend at the far end
  const inGame = FRIENDS.list.filter((f) => frGroup(f) === 0).length, online = FRIENDS.list.filter((f) => frGroup(f) === 1).length;
  frBmp(x, F.y + 1, FR_ICON.people, SC_LBL);
  drawPixelText(ctx, String(inGame), x + 12, F.y + 2, FR_COL.game, 1);
  drawPixelText(ctx, String(online), x + 18 + pixelTextWidth(String(inGame)), F.y + 2, FR_COL.on, 1);
  frBmp(F.add.x, F.add.y, FR_ICON.add, hit && hit.f && hit.f.head ? '#ffd95c' : SC_GOLD);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(x, F.y + 11, w, 1);
  const keyRows = F.rows.filter((r) => !r.f.sep);
  for (const r of F.rows) {
    const f = r.f, y = r.y;
    if (f.sep) { frBmp(x, y + 1, FR_ICON.recent, SC_LBL); ctx.fillStyle = SC_EDGE; ctx.fillRect(x + 11, y + 4, w - 11, 1); continue; }
    const hot = (hit && hit.f === f) || (m.fcur >= 0 && !hit && keyRows[m.fcur] === r), act = friendAct(f);
    ctx.fillStyle = f.fold ? SC_ROW_B : hot ? SC_HOT : SC_PLATE; ctx.fillRect(x, y, w, r.h);
    if (hot && m.fcur >= 0 && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 2, r.h); }
    if (f.fold) {
      ctx.fillStyle = FR_COL.off; ctx.fillRect(x + 4, y + 4, 4, 4);
      drawPixelText(ctx, String(f.n), x + 12, y + 4, hot ? SC_TXT : SC_DIM, 1);
      frBmp(x + w - 10, y + 5, FRIENDS.offOpen ? FR_ICON.unfold : FR_ICON.fold, hot ? SC_TXT : SC_DIM);
      continue;
    }
    ctx.fillStyle = frColor(f); ctx.fillRect(x + 4, y + 5, 4, 4);
    drawPixelText(ctx, talkClean(f.name).slice(0, 18) || '?', x + 12, y + 5, frGroup(f) === 3 ? SC_DIM : hot ? SC_LIT : SC_TXT, 1);
    if (f.game && f.state === 'room') { // their party: its mode and count, or their patch in red when it is not yours
      const sub = (PARTY_MODES[f.mode] || PARTY_MODES.quick) + '  ';
      drawPixelText(ctx, sub, x + 12, y + 13, SC_DIM, 1);
      drawPixelText(ctx, f.patch === PATCH_TXT ? f.n + '/' + FR_PARTY_MAX : frPatch(f.patch), x + 12 + pixelTextWidth(sub), y + 13, f.patch === PATCH_TXT ? SC_DIM : RM_BAD, 1);
    }
    const ix = x + w - 11, iy = y + 4;
    if (act === 'join') frBmp(ix + 1, iy - 1, FR_ICON.join, hot ? '#ffd95c' : SC_GOLD);
    else if (act === 'invite' && hot) frBmp(ix - 1, iy, FR_ICON.invite, '#ffd95c');
    else if (act === 'sent') frBmp(ix, iy + 1, FR_ICON.sent, RM_OK);
    else if (act === 'add') frBmp(ix - 1, iy - 1, FR_ICON.add, hot ? '#ffd95c' : SC_GOLD);
  }
  if (F.more) frBmp(x + (w >> 1) - 2, F.bottom - 3, FR_ICON.fold, SC_DIM);
}

// ---- the card -------------------------------------------------------------
function friendInvited(ev) {
  if (!ev || !ev.lobby || ev.lobby === friendsLobby()) return;
  FRIENDS.card = { name: ev.name || '', lobby: String(ev.lobby), mode: ev.mode, n: ev.n | 0, patch: ev.patch, t: FR_CARD_T };
  SFX.pickup();
  roomAttention();
}
if (window.steamBridge && window.steamBridge.onEvent) window.steamBridge.onEvent((ev) => { if (ev && ev.t === 'invite') friendInvited(ev); });
function friendCardRect() {
  if (!FRIENDS.card || state.mode !== 'title' || state.fade) return null;
  const x = VIEW_W - 24 - FR_CARD_W, y = VIEW_H - 92;
  return { x, y, w: FR_CARD_W, h: FR_CARD_H, join: { x: x + FR_CARD_W - 44, y: y + 7, w: 20, h: 9 }, close: { x: x + FR_CARD_W - 14, y: y + 7, w: 7, h: 9 } };
}
function friendCardHit() {
  const r = friendCardRect();
  if (!r) return null;
  if (inRect(r.join, 3)) return 'join';
  if (inRect(r.close, 3)) return 'close';
  return null;
}
// a click on the card's JOIN or cross; true when the card took it
function friendCardClick() {
  const h = friendCardHit();
  if (!h) return false;
  const c = FRIENDS.card;
  FRIENDS.card = null;
  if (h === 'join') steamJoinRequested(c.lobby); else SFX.pickup();
  return true;
}
function drawFriendCard() {
  const r = friendCardRect();
  if (!r) return;
  const c = FRIENDS.card, h = friendCardHit(), x = r.x, y = r.y;
  ctx.fillStyle = SC_INK; ctx.fillRect(x - 1, y - 1, r.w + 2, r.h + 2);
  ctx.fillStyle = SC_PLATE; ctx.fillRect(x, y, r.w, r.h);
  ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 2, r.h);
  frBmp(x + 7, y + 8, FR_ICON.invite, SC_GOLD);
  drawPixelText(ctx, talkClean(c.name).slice(0, 18) || '?', x + 19, y + 5, SC_LIT, 1);
  const sub = (PARTY_MODES[c.mode] || PARTY_MODES.quick) + '  ';
  drawPixelText(ctx, sub, x + 19, y + 13, SC_DIM, 1);
  drawPixelText(ctx, c.patch === PATCH_TXT ? c.n + '/' + FR_PARTY_MAX : frPatch(c.patch), x + 19 + pixelTextWidth(sub), y + 13, c.patch === PATCH_TXT ? SC_DIM : RM_BAD, 1);
  drawPixelText(ctx, 'JOIN', r.join.x, r.join.y + 2, h === 'join' ? '#ffd95c' : SC_GOLD, 1);
  frBmp(r.close.x + 1, r.close.y + 2, FR_ICON.x, h === 'close' ? SC_LIT : SC_DIM);
}
