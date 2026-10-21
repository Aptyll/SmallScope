// ------------------------------------------------------------ friends
// The party lobby's social column (League's, down the right edge; the
// pixels under `the column` below) and, under the wrapper with Steam up, the
// Steam friends in it, read every FR_POLL s off the bridge
// (desktop/steam-friends.js), and the people you played with. A friend's row
// is a face (the hero they last locked in while they are in Softfall), a dot
// on its corner and a line under the name in the colour of where they are -
// green in Softfall (their party and its count, a match), blue online, amber
// away, grey offline - in groups that fold (OFFLINE starts folded). The far
// end of a row says what a click does: the gold step JOINS a friend's open
// party (their lobby, the same reload a Steam invite takes:
// steamJoinRequested, js/ui/roomtalk.js), the letter INVITES an online friend
// to yours (shown under the pointer; Steam's own invite plus a card on their
// screen), a green tick is an invite just sent, and the gold person-plus on a
// played-with row opens Steam's add-friend page (a game cannot send a friend
// request itself). The person-plus at the column's head opens Steam's
// friends list. A friend's patch that is not yours shows in red where their
// party's count would be, and no step: that join would be refused. The keys
// reach the column from a seat with right, walk it with up and down (Enter
// on a group folds it), and leave it with left.
//
// THE CARD: a friend's invite while this screen is on the title - their
// name, their party, JOIN and a cross - bottom right, for FR_CARD_T s.
//
// PRESENCE: what this screen is doing goes into Steam's rich presence
// (friendsPresence): the `status` line Steam's own friends list shows, its
// Join Game (`connect`) while a party is open, and the sf_* keys the column
// above reads on a friend's row (sf_hero: their face). A minute into a match with people, the
// lobby's other members are marked played with (friendsPlayed).
//
// No bridge, no friends call, or a bridge that answers `ok: false` (koffi
// missing): FRIENDS.on stays false, the column keeps only its head (you and
// your code), and an empty seat's + still opens
// Steam's own invite.
const FR_POLL = 3;          // s between reads of the list while the title is up
const SOCIAL_W = 156;         // the social column down the right edge (drawSocial); the party's seats centre in what is left
const SOCIAL_PAD = 8;         // px inside the column's edges
const SOCIAL_HEAD = 46;       // the column's head (you and the code) ends on the page's head line
const FR_ROW = 20, FR_GROUP_H = 13; // a friend's row (face, name, what they are doing), a group's head
const FR_FACE = 16;         // a friend's face
const FR_TOP = 4;           // px between the head's line and the first group
const FR_GROUPS = { on: 'ONLINE', off: 'OFFLINE', recent: 'PLAYED WITH' };
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
  fold: ['#####', '.###.', '..#..'],
  shut: ['#..', '##.', '###', '##.', '#..'],
  head: ['...###....', '..#####...', '..#####...', '...###....', '..........', '.#######..', '#########.', '#########.'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
};
const FRIENDS = { on: false, list: [], recent: [], t: 0, busy: false, sent: {}, invites: [], fold: { off: true }, scroll: 0, card: null, rp: '', played: false, playT: 0 };

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
  const hero = String(PROFILE.hero()), key = [st, lobby, NET.mode || '', n, hero].join('|');
  if (key === FRIENDS.rp) return;
  FRIENDS.rp = key;
  const mode = PARTY_MODES[NET.mode] || PARTY_MODES.quick, word = mode.charAt(0) + mode.slice(1).toLowerCase();
  const status = st === 'match' ? 'In a match' : st === 'practice' ? 'Practice Tool' : st === 'room' ? word + ' party, ' + n + ' of ' + FR_PARTY_MAX : 'In the menus';
  b.presence({ status, connect: room && lobby ? '+connect_lobby ' + lobby : '', sf_lobby: room ? lobby : '', sf_mode: NET.mode || '', sf_n: String(n), sf_state: st, sf_patch: PATCH_TXT, sf_hero: hero });
}
function friendsPlayed(b, dt) {
  if (FRIENDS.played || state.mode === 'title' || PRACTICE || !friendsLobby() || !players.some((p) => p.control === 'remote')) return;
  if ((FRIENDS.playT += dt) < FR_PLAYED_T) return;
  FRIENDS.played = true;
  b.playedWith(friendsLobby());
}

// what a click on row f does: 'join', 'invite', 'add', 'fold', or null ('sent' draws a tick and does nothing)
function friendAct(f) {
  if (f.group) return 'fold';
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
  if (act === 'fold') { FRIENDS.fold[f.group] = !FRIENDS.fold[f.group]; SFX.pickup(); return; }
  if (act === 'add') { b.overlayUser('friendadd', f.id); SFX.place(); return; }
  if (act === 'join') { steamJoinRequested(f.lobby); return; }
  b.inviteFriend(friendsLobby(), f.id, { mode: NET.mode || 'quick', n: partySize(), patch: PATCH_TXT });
  FRIENDS.sent[f.id] = FR_SENT;
  FRIENDS.invites = FRIENDS.invites.filter((q) => q.id !== f.id).concat({ id: f.id, name: f.name }); // listed over INVITE (drawRoomInvite, rooms.js)
  SFX.place();
}

// ---- the column ------------------------------------------------------------
// One plate down the party screen's right edge, top to foot: YOU at its
// head (your face, your name, and under it the party's code in gold - a
// click copies it; dim, with a red dot blinking after it, while the link is
// down), and your friends down the rest of it. Without Steam the friends
// are not there and the column is your head alone.
function socialRect() { return { x: VIEW_W - SOCIAL_W, y: 0, w: SOCIAL_W, h: VIEW_H }; }
function socialCodeRect() {
  const R = socialRect(), code = roomCode();
  return code ? { x: R.x + SOCIAL_PAD + 34, y: 24, w: pixelTextWidth(code, 2), h: 10 } : null;
}
// Steam's friends list: the person-plus at the head's far end, level with your name
function socialAddRect() { const R = socialRect(); return { x: R.x + SOCIAL_W - SOCIAL_PAD - 8, y: 12, w: 8, h: 7 }; }
// the rows under the head, FRIENDS.scroll rows down
function friendsLayout(L) {
  if (!FRIENDS.on || !L.seats.length || state.menu.joining) return null;
  const R = socialRect(), x = R.x + SOCIAL_PAD, w = SOCIAL_W - 2 * SOCIAL_PAD, y = SOCIAL_HEAD;
  const bottom = VIEW_H - 10;
  const on = FRIENDS.list.filter((f) => frGroup(f) < 3), off = FRIENDS.list.filter((f) => frGroup(f) === 3);
  const rows = [];
  const group = (key, list) => {
    if (!list.length) return;
    rows.push({ group: key, n: list.length });
    if (!FRIENDS.fold[key]) rows.push(...list);
  };
  group('on', on); group('off', off); group('recent', FRIENDS.recent);
  const H = (f) => (f.group ? FR_GROUP_H : FR_ROW);
  FRIENDS.scroll = Math.max(0, Math.min(FRIENDS.scroll, rows.length - 1));
  const out = [];
  let yy = y + FR_TOP;
  for (let i = FRIENDS.scroll; i < rows.length; i++) {
    const h = H(rows[i]);
    if (yy + h > bottom) break;
    out.push({ x: R.x, y: yy, w: SOCIAL_W, h, f: rows[i] });
    yy += h;
  }
  return { x, y, w, bottom, rows: out, more: FRIENDS.scroll + out.length < rows.length, add: socialAddRect() };
}
function friendsScrollBy(d) { FRIENDS.scroll = Math.max(0, FRIENDS.scroll + d); }
function friendsOver() { const F = state.menu.screen === 'room' ? friendsLayout(roomLayout()) : null; return !!F && mouse.x >= F.x && mouse.y >= F.y && mouse.y < F.bottom; }
function friendsHit(L) {
  const F = friendsLayout(L);
  if (!F) return null;
  if (inRect(F.add, 3)) return { kind: 'friend', f: { head: true } };
  for (const r of F.rows) if (inRect(r)) return { kind: 'friend', f: r.f };
  return null;
}
function friendHeadDo() { const b = friendsBridge(); if (b) { b.overlayFriends(); SFX.place(); } }
// the keys: right from a seat enters the column, up and down walk its rows, left goes back
function friendsKey(k, L) {
  const m = state.menu, F = friendsLayout(L), d = moveDir(k);
  if (!F || !F.rows.length) { m.fcur = -1; return false; }
  const rows = F.rows;
  const at = Math.max(0, Math.min(rows.length - 1, m.fcur));
  if (d === 'left' || k === 'escape') { m.fcur = -1; m.rseat = L.seats[L.seats.length - 1].p.id; SFX.pickup(); return true; }
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
// what a friend is doing, in their colour: their party and its count (the
// count red as their patch when it is not yours), a match, or Steam's state
function frStatus(f) {
  const g = frGroup(f);
  if (g === 0) {
    if (f.state === 'room') return { t: (PARTY_MODES[f.mode] || PARTY_MODES.quick) + ' ', n: f.patch === PATCH_TXT ? f.n + '/' + FR_PARTY_MAX : frPatch(f.patch), bad: f.patch !== PATCH_TXT };
    return { t: f.state === 'match' ? 'IN A MATCH' : f.state === 'practice' ? PARTY_MODES.practice : 'SOFTFALL' };
  }
  return { t: ['', 'ONLINE', 'AWAY', 'OFFLINE'][g] };
}
// a friend's face: the hero they last locked in while they are in Softfall, a
// bare head and shoulders in their colour otherwise; their dot on its corner
function drawFriendFace(x, y, f) {
  const s = FR_FACE;
  ctx.fillStyle = SC_INK; ctx.fillRect(x, y, s, s);
  if (f.game && f.hero !== '' && f.hero != null && CLASSES[f.hero | 0]) drawFace(x + 1, y + 1, s - 2, { cls: f.hero | 0, team: 0 });
  else {
    ctx.fillStyle = SC_ROW_B; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    frBmp(x + 3, y + 3, FR_ICON.head, frGroup(f) === 3 ? SC_EDGE : '#3c4048');
  }
  ctx.fillStyle = SC_INK; ctx.fillRect(x + s - 5, y + s - 5, 6, 6);
  ctx.fillStyle = frColor(f); ctx.fillRect(x + s - 4, y + s - 4, 4, 4);
}
function drawSocial(L, now, hit) {
  const m = state.menu, R = socialRect(), x = R.x + SOCIAL_PAD, w = SOCIAL_W - 2 * SOCIAL_PAD;
  ctx.fillStyle = SC_ROW_B; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(R.x, R.y, 1, R.h);
  // the head: you, and the party's code behind the link's pip
  drawScoreFace(x, 10, 26, { id: localId, you: true, team: player.team, level: player.level || 1 });
  drawPixelText(ctx, (player.name || '').slice(0, 14), x + 34, 12, SC_LIT, 1);
  const cr = socialCodeRect(), up = !!(NET.transport && NET.transport.open);
  if (cr) drawPixelText(ctx, roomCode(), cr.x, cr.y, !up ? SC_DIM : now - (m.copyAt || -9) < 0.5 ? SC_LIT : hit && hit.kind === 'code' ? '#ffd95c' : SC_GOLD, 2);
  if (!up && Math.floor(now * 3) % 2) { ctx.fillStyle = RM_BAD; ctx.fillRect(x + 34 + (cr ? cr.w + 4 : 0), 27, 4, 4); } // the link is down: the code would find nothing
  if (FRIENDS.on) { const a = socialAddRect(); frBmp(a.x, a.y, FR_ICON.add, hit && hit.f && hit.f.head ? '#ffd95c' : SC_GOLD); }
  ctx.fillStyle = SC_EDGE; ctx.fillRect(R.x, SOCIAL_HEAD, R.w, 1);
  if (!m.joining) drawFriends(L, hit && hit.kind === 'friend' ? hit : null);
}
function drawFriends(L, hit) {
  const F = friendsLayout(L), m = state.menu;
  if (!F) return;
  const x = F.x, w = F.w;
  for (const r of F.rows) {
    const f = r.f, y = r.y, hot = (hit && hit.f === f) || (m.fcur >= 0 && !hit && F.rows[m.fcur] === r);
    if (hot) { ctx.fillStyle = SC_HOT; ctx.fillRect(r.x + 1, y, r.w - 1, r.h); }
    if (hot && m.fcur >= 0 && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(r.x + 1, y, 2, r.h); }
    if (f.group) { // a group's head: its fold, its word, how many
      frBmp(x, y + 4, FRIENDS.fold[f.group] ? FR_ICON.shut : FR_ICON.fold, hot ? SC_TXT : SC_DIM);
      const word = FR_GROUPS[f.group];
      drawPixelText(ctx, word, x + 9, y + 3, hot ? SC_TXT : SC_LBL, 1);
      drawPixelText(ctx, String(f.n), x + 15 + pixelTextWidth(word), y + 3, SC_DIM, 1);
      continue;
    }
    const act = friendAct(f), off = frGroup(f) === 3;
    drawFriendFace(x, y + 2, f);
    drawPixelText(ctx, talkClean(f.name).slice(0, 16) || '?', x + FR_FACE + 6, y + 3, off ? SC_DIM : hot ? SC_LIT : SC_TXT, 1);
    const st = frStatus(f), sx = x + FR_FACE + 6, sy = y + 11, col = off ? SC_EDGE : frColor(f);
    drawPixelText(ctx, st.t, sx, sy, col, 1);
    if (st.n) drawPixelText(ctx, st.n, sx + pixelTextWidth(st.t) + 3, sy, st.bad ? RM_BAD : col, 1);
    const ix = x + w - 7, iy = y + 6;
    if (act === 'join') frBmp(ix + 2, iy, FR_ICON.join, hot ? '#ffd95c' : SC_GOLD);
    else if (act === 'invite' && hot) frBmp(ix, iy + 1, FR_ICON.invite, '#ffd95c');
    else if (act === 'sent') frBmp(ix + 2, iy + 2, FR_ICON.sent, RM_OK);
    else if (act === 'add') frBmp(ix - 1, iy, FR_ICON.add, hot ? '#ffd95c' : SC_GOLD);
  }
  if (F.more) frBmp(x + (w >> 1) - 2, F.bottom + 1, FR_ICON.fold, SC_DIM);
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
