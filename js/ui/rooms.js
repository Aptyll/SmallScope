// ------------------------------------------------------------ rooms
// The MULTIPLAYER plank's two screens, League's custom games read in the
// post-game page's Graphite (js/ui/lobby.js): flat, opaque, a big head, the
// actions plain words at the foot (docs/pvp-architecture.md has the wire).
//
// CUSTOM GAMES (menu.screen 'rooms') is the list: the relay's open rooms -
// or, under the wrapper with Steam asked for (netSteam), Steam's lobbies
// (steamRooms, js/net/transport-steam.js) in the same shape - one row each:
// the host's game, its map, ten seat pips (the people lit in their side's
// paint), a red dot once its match is under way and its four-letter code. A
// room on another patch is dimmed and inert, its patch printed where the
// code would be. A click picks a row, a second click or JOIN joins it; the
// row stays gold until the host's WELCOME, or rattles if the room would not
// have us. CREATE hosts a room and opens it.
//
// THE ROOM (menu.screen 'room') is the waiting room before the pick: both
// sides in two columns of five seats, each a face, a name and the class. A
// click on a seat across the rule moves you there - the bot or the empty
// seat in it walks over to where you stood (seatSwap, js/net/net.js) - and
// the host's hand on a seat's far end shows a person out, empties a bot's
// seat or puts a bot back in an empty one. The host's START takes every
// screen to the pick (the lobby, js/ui/menu.js: the stage, LOCK IN and the
// count), and the host's ESC there brings everyone back here.
const RM_MAX = 12;                     // rows the list shows
const RM_X = 40, RM_Y = 58, RM_ROW = 18; // the list's left edge, first row and pitch
const RM_PIP = 4, RM_PIP_GAP = 2, RM_PIP_SIDE = 4; // a seat pip, its gap, the gap between the two sides' fives
const RM_WORDS = ['CREATE', 'JOIN', 'BACK'];
const RS_TOP = 66, RS_H = 34, RS_GAP = 4, RS_RULE = 24; // the room: first seat, a seat's height, between seats, between the columns
const RS_TOOL = 24;                    // px at a seat's far end that is the host's hand (kick, empty, add a bot)

let roomsFeed = null; // the relay's list socket while the list is up (wsRooms)
function beginRooms() {
  const m = state.menu;
  m.screen = 'rooms';
  m.rooms = []; m.roomsOk = false; m.rsel = -1; m.rword = 1; m.roomsShake = 0;
  if (roomsFeed) roomsFeed.close();
  const feed = (rooms, ok) => {
    const keep = m.rsel >= 0 && m.rooms[m.rsel] ? m.rooms[m.rsel].room : null; // the pick stays on its room as the list moves
    m.rooms = rooms.slice(0, RM_MAX); m.roomsOk = ok;
    if (keep !== null) m.rsel = m.rooms.findIndex((r) => r.room === keep);
  };
  roomsFeed = netSteam() ? steamRooms(feed) : wsRooms(netRelay(), feed); // Steam's lobbies under the wrapper, the relay's rooms otherwise
  SFX.place();
  SFX.music.play('lobby');
}
function roomsFeedClose() { if (roomsFeed) { roomsFeed.close(); roomsFeed = null; } }
function leaveRooms() {
  roomsFeedClose();
  if (NET.role !== 'solo') netLeave();
  state.menu.screen = 'menu';
  SFX.pickup();
  SFX.music.play('intro');
}
function roomOk(r) { return r.data && r.data.patch === PATCH_TXT; }
function roomJoining(k) { return k === state.menu.rsel && NET.role === 'client'; }

// the list's rows and the three words at the foot
function roomsLayout() {
  const w = VIEW_W - RM_X * 2;
  const rows = state.menu.rooms.map((r, k) => ({ x: RM_X, y: RM_Y + k * RM_ROW, w, h: RM_ROW - 1, k }));
  return { x: RM_X, w, rows, words: roomWords(RM_WORDS) };
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
function roomsHit() {
  const L = roomsLayout();
  for (let i = 0; i < L.words.length; i++) if (inRect(L.words[i], 3)) return { kind: 'word', i };
  for (const r of L.rows) if (roomOk(state.menu.rooms[r.k]) && inRect(r)) return { kind: 'row', k: r.k };
  return null;
}
function hostRoom() {
  roomsFeedClose();
  netHost();
  beginRoom();
}
function joinRoom(k) {
  const m = state.menu, r = m.rooms[k];
  if (!r || !roomOk(r) || NET.role === 'client') return;
  m.rsel = k;
  // the world is the host's: SEED and MAP_TYPE are both decided at load
  // (js/core.js, js/boot.js), so a page born on another seed OR another
  // shape starts over on the room's and joins from boot (?join=)
  const seed = r.data && +r.data.seed, map = (r.data && r.data.map | 0) || 0;
  if (seed && (seed !== SEED || map !== MAP_TYPE)) { location.search = '?seed=' + seed + '&map=' + map + '&join=' + r.room + (netSteam() ? '&transport=steam' : ''); return; }
  netJoin(r.room);
  SFX.place();
}
function roomsWord(i) {
  const m = state.menu, w = RM_WORDS[i];
  m.rword = i;
  if (w === 'CREATE') { m.pressT = 0.12; hostRoom(); }
  else if (w === 'BACK') leaveRooms();
  else if (m.rsel >= 0) joinRoom(m.rsel);
  else SFX.deny();
}
function roomsKey(k) {
  const m = state.menu, n = m.rooms.length;
  if (k === 'escape' || k === 'backspace') { leaveRooms(); return; }
  const d = moveDir(k);
  if (d === 'up' && n) { m.rsel = m.rsel <= 0 ? n - 1 : m.rsel - 1; SFX.pickup(); }
  else if (d === 'down' && n) { m.rsel = (m.rsel + 1) % n; SFX.pickup(); }
  else if (d === 'left') { m.rword = (m.rword + RM_WORDS.length - 1) % RM_WORDS.length; SFX.pickup(); }
  else if (d === 'right') { m.rword = (m.rword + 1) % RM_WORDS.length; SFX.pickup(); }
  else if (k === 'enter' || k === ' ') roomsWord(m.rword);
}
function roomsClick() {
  const m = state.menu;
  if (m.roomsT < 1) return;
  const h = roomsHit();
  if (!h) return;
  if (h.kind === 'word') { roomsWord(h.i); return; }
  if (m.rsel === h.k) { joinRoom(h.k); return; } // the second click on a picked row joins it
  m.rsel = h.k; m.rword = 1;
  SFX.pickup();
}
function updateRooms(dt) {
  const m = state.menu;
  if (m.roomsShake > 0) m.roomsShake = Math.max(0, m.roomsShake - dt);
  // a join answered: the host's screen on a welcome (the room, or the pick
  // if the host is already there), a rattle on a refusal
  if (m.screen === 'rooms' && NET.role === 'client') {
    if (NET.welcomed) { roomsFeedClose(); if (NET.phase === 'pick') beginLobby(); else beginRoom(); }
    else if (NET.refused || (NET.transport.error && !NET.transport.open)) { netLeave(); m.roomsShake = NAME_SHAKE_T; SFX.deny(); }
  }
}

// ------------------------------------------------------------ the room
function beginRoom() {
  const m = state.menu;
  m.screen = 'room';
  m.rseat = -1; m.rword = 1;
  m.countT = 0; m.countN = -1;
  SFX.place();
  SFX.music.play('lobby');
}
// the room's host's body: ours, or the slot the welcome named
function roomHost() { return players[NET.isClient ? NET.hostSlot : localId]; }
// the five seats of side t, in slot order: the same five, the same order, on every screen
function roomSide(t) { return players.filter((p) => p.team === t); }
// the seats laid out: your side on the left, the rival side on the right,
// the way the pick screen and the post-game page both stand them
function roomLayout() {
  const x = 24, w = VIEW_W - 48, colW = (w - RS_RULE) >> 1;
  const mine = player ? player.team : 0;
  const cols = [mine, 1 - mine].map((t, c) => ({ t, x: x + c * (colW + RS_RULE) }));
  const seats = [];
  for (const c of cols) roomSide(c.t).forEach((p, k) => seats.push({ x: c.x, y: RS_TOP + k * (RS_H + RS_GAP), w: colW, h: RS_H, p, c: cols.indexOf(c), k }));
  const labels = NET.isClient ? ['LEAVE'] : ['LEAVE', 'START'];
  return { x, w, colW, cols, seats, words: roomWords(labels), labels };
}
// what a click on seat s does from this screen: 'swap' (move there), 'kick'
// (the host shows a person out), 'empty' (the host takes a bot out), 'bot'
// (the host puts one in) or null. tool: the pointer is on the seat's far end.
function seatAct(s, tool) {
  const p = s.p, host = NET.role === 'host';
  if (p === player || !seatsOpen()) return null;
  if (host && (tool || p.team === player.team)) return isHuman(p) ? 'kick' : p.control === 'none' ? 'bot' : 'empty';
  return seatCanSwap(localId, p.id) ? 'swap' : null;
}
function roomHit() {
  const L = roomLayout();
  for (let i = 0; i < L.words.length; i++) if (inRect(L.words[i], 3)) return { kind: 'word', w: L.labels[i] };
  for (const s of L.seats) if (inRect(s)) {
    const act = seatAct(s, mouse.x >= s.x + s.w - RS_TOOL);
    return act ? { kind: 'seat', id: s.p.id, act } : null;
  }
  return null;
}
function roomDo(h) {
  if (!h) return;
  if (h.kind === 'word') {
    if (h.w === 'LEAVE') leaveRoom();
    else if (h.w === 'START') roomStart();
    return;
  }
  if (h.act === 'swap') { netSeat(h.id); SFX.place(); }
  else if (h.act === 'kick') { seatKick(h.id); SFX.deny(); }
  else { seatBot(h.id); SFX.pickup(); }
}
function roomClick() {
  if (state.menu.roomsT < 1) return;
  roomDo(roomHit());
}
// the keys walk a cursor over the ten seats (left/right across the rule)
// and down onto the words; Enter does what a click there would
function roomKey(k) {
  const m = state.menu, L = roomLayout();
  if (k === 'escape' || k === 'backspace') { leaveRoom(); return; }
  const d = moveDir(k);
  const at = L.seats.findIndex((s) => s.p.id === m.rseat);
  if (d === 'up' || d === 'down') {
    if (at < 0) { if (d === 'up') m.rseat = L.seats[4].p.id; } // off the words, up onto your side's last seat
    else {
      const s = L.seats[at], col = L.seats.filter((q) => q.c === s.c);
      const k2 = s.k + (d === 'down' ? 1 : -1);
      m.rseat = k2 < 0 ? s.p.id : k2 >= col.length ? -1 : col[k2].p.id;
    }
    SFX.pickup();
  } else if (d === 'left' || d === 'right') {
    if (at < 0) m.rword = (m.rword + (d === 'right' ? 1 : L.labels.length - 1)) % L.labels.length;
    else { const s = L.seats[at], o = L.seats.find((q) => q.c !== s.c && q.k === s.k); if (o) m.rseat = o.p.id; }
    SFX.pickup();
  } else if (k === 'enter' || k === ' ') {
    if (at >= 0) { const act = seatAct(L.seats[at], false); if (act) roomDo({ kind: 'seat', id: m.rseat, act }); else SFX.deny(); }
    else roomDo({ kind: 'word', w: L.labels[Math.min(m.rword, L.labels.length - 1)] });
  }
}
function leaveRoom() {
  netLeave(); // a host's room closes under everyone in it; a guest walks out of one
  beginRooms();
}
// the host's START: every screen to the pick, together
function roomStart() {
  if (NET.role !== 'host') return;
  netPhase('pick');
  state.menu.pressT = 0.12;
  beginLobby();
}

// ------------------------------------------------------------ the pixels
// a seat-move's mark: two arrows passing, 10x9
function drawSwapMark(x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y + 2, 8, 1); ctx.fillRect(x + 6, y + 1, 1, 3); ctx.fillRect(x + 5, y, 1, 5);
  ctx.fillRect(x + 2, y + 6, 8, 1); ctx.fillRect(x + 3, y + 5, 1, 3); ctx.fillRect(x + 4, y + 4, 1, 5);
}
function drawXMark(x, y, col) { ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + 4 - i, y + i, 1, 1); } }
function drawPlusMark(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 2, 5, 1); ctx.fillRect(x + 2, y, 1, 5); }
function drawCrown(x, y) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1); ctx.fillRect(x, y + 1, 5, 1); }
// a word at the foot: white, gold under the pointer or the keys, lifted a px
function drawRoomWord(r, hot, dim) {
  drawPixelTextOutline(ctx, r.label, r.x + 4, r.y + 2 - (hot ? 1 : 0), dim ? SC_DIM : hot ? '#ffd95c' : SC_LIT, 'rgba(8,12,28,0.9)', MENU_TXT_SCALE);
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
// the ten seats of a room as pips, five a side, the people in them lit in
// that side's paint (the list carries a count per side). Returns the width
function drawSeatPips(x, y, sides) {
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? 0 : 1, k = i % 5;
    const px = x + i * (RM_PIP + RM_PIP_GAP) + (side ? RM_PIP_SIDE : 0);
    ctx.fillStyle = k < ((sides && sides[side]) | 0) ? TEAMS[skin(side)].mark : '#353941';
    ctx.fillRect(px, y, RM_PIP, RM_PIP + 1);
  }
  return 10 * RM_PIP + 9 * RM_PIP_GAP + RM_PIP_SIDE;
}
// a room's name on the list and over the room: its host's game
function roomTitle(name) { return (name || '?') + "'S GAME"; }

function renderRooms(now, a) {
  if (state.menu.screen === 'room') { renderRoom(now, a); return; }
  const m = state.menu, L = roomsLayout();
  const hit = m.roomsT >= 1 ? roomsHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPixelTextShadow(ctx, 'CUSTOM GAMES', L.x, 18, SC_LIT, SC_INK, 2);
  drawRelayPip(L.x + L.w - 5, 21, m.roomsOk, now);
  const col = { map: 230, seats: 330, n: 402, code: L.w - 30 };
  drawPixelText(ctx, 'GAME', L.x + 6, 46, SC_DIM, 1);
  drawPixelText(ctx, 'MAP', L.x + col.map + 6, 46, SC_DIM, 1);
  drawPixelText(ctx, 'PLAYERS', L.x + col.seats + 6, 46, SC_DIM, 1);
  if (!netSteam()) drawPixelText(ctx, 'CODE', L.x + col.code + 6, 46, SC_DIM, 1);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 55, L.w, 1);
  // an empty list: one ghost of a row, breathing, where the first room will stand
  if (!L.rows.length) {
    ctx.globalAlpha = a * (m.roomsOk ? 0.5 + 0.2 * Math.sin(now * 2) : 0.25);
    ctx.fillStyle = SC_EDGE;
    for (let x = 0; x < L.w; x += 3) { ctx.fillRect(L.x + x, RM_Y, 1, 1); ctx.fillRect(L.x + x, RM_Y + RM_ROW - 2, 1, 1); }
    ctx.globalAlpha = a;
  }
  const shake = m.roomsShake > 0 ? Math.round(Math.sin(m.roomsShake * 60) * 2 * (m.roomsShake / NAME_SHAKE_T)) : 0;
  for (const r of L.rows) {
    const room = m.rooms[r.k], d = room.data || {}, ok = roomOk(room);
    const on = r.k === m.rsel, hot = hit && hit.kind === 'row' && hit.k === r.k, joining = roomJoining(r.k);
    const x = r.x + (on ? shake : 0), y = r.y;
    ctx.globalAlpha = a;
    ctx.fillStyle = on || hot ? SC_HOT : r.k & 1 ? SC_ROW_B : SC_ROW_A; ctx.fillRect(x, y, r.w, r.h);
    if (on) { ctx.fillStyle = SC_GOLD; ctx.fillRect(x, y, 1, r.h); }
    ctx.globalAlpha = a * (ok ? 1 : 0.4);
    drawPixelText(ctx, roomTitle(d.name), x + 6, y + 6, joining ? SC_GOLD : on || hot ? SC_LIT : SC_TXT, 1);
    drawPixelText(ctx, mapName(d.map | 0), x + col.map + 6, y + 6, SC_LBL, 1);
    const sides = d.sides || [Math.min(5, d.humans | 0), 0];
    drawSeatPips(x + col.seats + 6, y + 6, sides);
    drawPixelText(ctx, ((sides[0] | 0) + (sides[1] | 0)) + '/10', x + col.n + 6, y + 6, SC_LBL, 1);
    if (d.state === 'live') { ctx.fillStyle = '#e0524f'; ctx.fillRect(x + col.n + 32, y + 7, 3, 3); } // a match already under way
    if (!ok) { const pt = String(d.patch || '').replace(/^PATCH /, ''); drawPixelText(ctx, pt, x + r.w - 6 - pixelTextWidth(pt), y + 6, '#e0524f', 1); }
    else { const code = String(room.room || ''); if (code.length <= 6) drawPixelText(ctx, code, x + col.code + 6, y + 6, joining || on ? SC_GOLD : SC_LBL, 1); } // a Steam lobby's id is not for reading aloud
  }
  ctx.globalAlpha = a;
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.i === i : m.rword === i;
    drawRoomWord(w, hot, RM_WORDS[i] === 'JOIN' && m.rsel < 0);
  }
  ctx.globalAlpha = 1;
}

// One seat: the side's paint down its edge, the face, the name and under it
// the class (a bot's reads BOT), the class mark at the far end. Yours wears
// the gold rim, the host's face a crown, and a seat that just changed hands
// flashes (cardFx, updateTitle). Under the pointer it shows what a click does.
function drawRoomSeat(s, act, flash) {
  const p = s.p, me = p === player, x = s.x, y = s.y, w = s.w, h = s.h;
  ctx.fillStyle = flash ? '#3a3e46' : act ? SC_HOT : me ? SC_YOU : SC_PLATE; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = TEAMS[skin(p.team)].mark; ctx.fillRect(x, y, 2, h);
  if (me) { ctx.fillStyle = '#c89a3c'; ctx.fillRect(x + 2, y, w - 2, 1); ctx.fillRect(x + 2, y + h - 1, w - 2, 1); ctx.fillRect(x + w - 1, y, 1, h); }
  const tx = x + w - 14, ty = y + ((h - 5) >> 1); // the far end: the host's hand
  if (!p.active) { // an empty seat: a dotted well where the face would be
    ctx.fillStyle = SC_EDGE;
    for (let i = 0; i < 26; i += 2) { ctx.fillRect(x + 8 + i, y + 4, 1, 1); ctx.fillRect(x + 8 + i, y + 29, 1, 1); ctx.fillRect(x + 8, y + 4 + i, 1, 1); ctx.fillRect(x + 33, y + 4 + i, 1, 1); }
    if (act === 'swap') drawSwapMark(x + 16, y + 13, SC_GOLD);
    if (act === 'bot') drawPlusMark(tx, ty, SC_GOLD);
    return;
  }
  drawScoreFace(x + 8, y + 4, 26, { id: p.id, you: me, team: p.team, level: p.level || 1 });
  if (p === roomHost()) drawCrown(x + 19, y + 1);
  const bot = !isHuman(p);
  drawPixelText(ctx, p.name, x + 42, y + 10, me ? SC_GOLD : bot ? SC_LBL : SC_LIT, 1);
  drawPixelText(ctx, bot ? 'BOT' : CLASSES[p.cls].name, x + 42, y + 19, SC_DIM, 1);
  ctx.drawImage(classIcon12(p.cls, false), x + w - 22 - (act === 'kick' || act === 'empty' ? 16 : 0), y + 11);
  if (act === 'swap') drawSwapMark(x + w - 40, y + 13, SC_GOLD);
  if (act === 'kick' || act === 'empty') drawXMark(tx, ty, '#e0524f');
}

function renderRoom(now, a) {
  const m = state.menu, L = roomLayout();
  const hit = m.roomsT >= 1 ? roomHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const hp = roomHost();
  drawPixelTextShadow(ctx, roomTitle(hp && hp.name), L.x, 16, SC_LIT, SC_INK, 2);
  drawPixelText(ctx, mapName(MAP_TYPE), L.x, 34, SC_DIM, 1);
  // the code a host reads to a friend, gold, with the relay's pip
  const code = String((NET.transport && (NET.transport.room || '')) || '');
  const cw = code.length <= 6 ? pixelTextWidth(code, 2) : 0;
  if (cw) drawPixelText(ctx, code, L.x + L.w - cw, 16, SC_GOLD, 2);
  drawRelayPip(L.x + L.w - cw - 10, 19, !!(NET.transport && NET.transport.open), now);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 46, L.w, 1);
  for (const c of L.cols) {
    const side = TEAMS[skin(c.t)];
    drawPixelText(ctx, side.name, c.x, 56, side.mark, 1);
    const n = roomSide(c.t).filter(isHuman).length + ' / 5';
    drawPixelText(ctx, n, c.x + L.colW - pixelTextWidth(n), 56, SC_DIM, 1);
  }
  for (const s of L.seats) {
    let act = hit && hit.kind === 'seat' && hit.id === s.p.id ? hit.act : null;
    if (!act && m.rseat === s.p.id) act = seatAct(s, false) || 'none'; // the keys' cursor lights the seat too
    drawRoomSeat(s, act === 'none' ? null : act, m.cardFx && m.cardFx[s.p.id] > 0);
    if (m.rseat === s.p.id && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(s.x, s.y, 2, s.h); }
  }
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.w === w.label : m.rseat < 0 && m.rword === i;
    drawRoomWord(w, hot, false);
  }
  // a guest's foot: the room waits on its host, named where START would be
  if (NET.isClient && hp) {
    const nm = hp.name, x = Math.round(VIEW_W / 2 + 60);
    drawCrown(x, L.words[0].y + 4);
    drawPixelText(ctx, nm, x + 9, L.words[0].y + 4, SC_DIM, 1);
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
  const code = String((NET.transport && (NET.transport.room || NET.transport.lobbyId)) || '');
  const x = LOBBY_PAD, y = LOBBY_HEAD - 20;
  ctx.globalAlpha = a;
  drawRelayPip(x, y + 6, !!(NET.transport && NET.transport.open), now);
  if (code && code.length <= 6) drawCodePlate(x + 9, y, code, '#ffd95c', 2); // a relay code; a Steam lobby is joined off the list
}
// In a match, a client whose socket is down: a red pip blinking top-centre
// while the transport redials, and nothing at all while the link is good
function drawNetLink(now) {
  if (!NET.isClient || (NET.transport && NET.transport.open && NET.synced)) return;
  drawRelayPip(Math.round(VIEW_W / 2) - 2, 3, false, now);
}
