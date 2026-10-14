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
// have us. CREATE opens the host page (below), whose CREATE opens the room. The CODE box top-right joins a
// room by the four letters a friend pasted somewhere: click it and type, or
// paste (Ctrl+V) anywhere on the list - a whole code joins at once. The
// room's own code, top-right in the room, copies itself on a click.
//
// THE ROOM (menu.screen 'room') is the waiting room before the match: both
// sides in two columns of five seats, each a face, a name and the class. A
// click on a seat across the rule moves you there - the bot or the empty
// seat in it walks over to where you stood (seatSwap, js/net/net.js) - and
// the host's hand on a seat's far end shows a person out, empties a bot's
// seat or puts a bot back in an empty one. A guest's READY ticks its name
// and the host's START stays dim until every person has (a press then
// flashes the seats it waits on); three bars by a person's class mark are
// their link to the host (NET.pings); the room's options read under the
// title, TEAMS and BOTS the host's to turn there. The host's START takes
// every screen straight into the match: no pick for now (the lobby's stage
// and LOCK IN, js/ui/menu.js, still answer a 'pick' phase). After the
// match, LOBBY brings everyone back to the room on a fresh valley (the
// rematch, below).
const RM_MAX = 12;                     // rows the list shows
const RM_X = 40, RM_Y = 58, RM_ROW = 18; // the list's left edge, first row and pitch
const RM_PIP = 4, RM_PIP_GAP = 2, RM_PIP_SIDE = 4; // a seat pip, its gap, the gap between the two sides' fives
const RM_WORDS = ['CREATE', 'JOIN', 'BACK'];
const RS_TOP = 66, RS_H = 34, RS_GAP = 4, RS_RULE = 24; // the room: first seat, a seat's height, between seats, between the columns
const RS_TOOL = 24;                    // px at a seat's far end that is the host's hand (kick, empty, add a bot)
const RS_CLS = 38;                     // px in from a seat's far end to its class mark, clear of the hand
const RM_CODE_N = 4;                   // letters in a relay code (makeCode, app/server.js)
const RM_CODE_W = 52, RM_CODE_H = 16;  // the CODE box on the list

let roomsFeed = null; // the relay's list socket while the list is up (wsRooms)
function beginRooms() {
  const m = state.menu;
  m.screen = 'rooms';
  m.rooms = []; m.roomsOk = false; m.rsel = -1; m.rword = 1; m.roomsShake = 0;
  m.rkeys = false; // the keys' pick shows only once a key has moved it (at rest nothing is lit)
  m.code = ''; m.codeOn = false; m.codeShake = 0;
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
  const box = { x: RM_X + w - RM_CODE_W, y: 14, w: RM_CODE_W, h: RM_CODE_H };
  return { x: RM_X, w, rows, box, words: roomWords(RM_WORDS) };
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
  if (!netSteam() && inRect(L.box, 2)) return { kind: 'code' }; // a Steam lobby has no code to type
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
  if (w === 'CREATE') { m.pressT = 0.12; beginHost(); }
  else if (w === 'BACK') leaveRooms();
  else if (m.rsel >= 0) joinRoom(m.rsel);
  else SFX.deny();
}
// a code typed or pasted: the room it names, joined off the list (the list
// carries its seed and shape, which a join must match), or a rattle
function joinCode(code) {
  const m = state.menu;
  const k = m.rooms.findIndex((r) => String(r.room).toUpperCase() === code);
  if (k < 0 || !roomOk(m.rooms[k])) { m.codeShake = NAME_SHAKE_T; SFX.deny(); return; }
  m.codeOn = false;
  joinRoom(k);
}
// a letter into the box: the four letters a code is made of, nothing else
function codeType(ch) {
  const m = state.menu, c = String(ch || '').toUpperCase();
  if (!/^[A-Z0-9]$/.test(c) || m.code.length >= RM_CODE_N) return false;
  m.code += c;
  SFX.pickup();
  if (m.code.length === RM_CODE_N) joinCode(m.code);
  return true;
}
// Ctrl+V on the list: the first four-letter run in what was copied
pageListen(window, 'paste', (e) => {
  const m = state.menu;
  if (state.mode !== 'title' || m.screen !== 'rooms' || netSteam()) return;
  const txt = ((e.clipboardData && e.clipboardData.getData('text')) || '').toUpperCase();
  const words = txt.match(new RegExp('\\b[A-Z0-9]{' + RM_CODE_N + '}\\b', 'g')) || [];
  e.preventDefault();
  if (!words.length) { m.codeShake = NAME_SHAKE_T; SFX.deny(); return; }
  // "code: ACKT" holds two such words: the one a listed room answers to wins
  m.code = words.find((w) => m.rooms.some((r) => String(r.room).toUpperCase() === w)) || words[words.length - 1];
  m.codeOn = true;
  joinCode(m.code);
});
function roomsKey(k, e) {
  const m = state.menu, n = m.rooms.length;
  m.rkeys = true;
  // the CODE box owns the keys while it is lit: letters type, Backspace
  // takes one back, Esc and Enter put it away (Enter trying the code)
  if (m.codeOn) {
    if (k === 'escape') { m.codeOn = false; SFX.pickup(); }
    else if (k === 'backspace') { m.code = m.code.slice(0, -1); SFX.pickup(); }
    else if (k === 'enter') { if (m.code.length) joinCode(m.code); else m.codeOn = false; }
    else codeType(e && e.char && e.char.length === 1 ? e.char : k);
    return;
  }
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
  m.codeOn = h.kind === 'code';
  if (h.kind === 'code') { m.code = ''; SFX.pickup(); return; }
  if (h.kind === 'word') { roomsWord(h.i); return; }
  if (m.rsel === h.k) { joinRoom(h.k); return; } // the second click on a picked row joins it
  m.rsel = h.k; m.rword = 1;
  SFX.pickup();
}
function updateRooms(dt) {
  const m = state.menu;
  if (m.roomsShake > 0) m.roomsShake = Math.max(0, m.roomsShake - dt);
  if (m.codeShake > 0) m.codeShake = Math.max(0, m.codeShake - dt);
  // a join answered: the host's screen on a welcome (the room, or the pick
  // if the host is already there), a rattle on a refusal
  if (m.screen === 'rooms' && NET.role === 'client') {
    if (NET.welcomed) { roomsFeedClose(); m.joinWait = 0; if (NET.phase === 'pick') beginLobby(); else beginRoom(); }
    else if (NET.refused || (NET.transport.error && !NET.transport.open)) {
      const why = NET.refused || NET.transport.error;
      netLeave();
      // back from a match: the host may not have reopened the room yet, so
      // the join is tried again for a while before it counts as a refusal
      if (m.joinWait > 0 && why !== 'KICKED' && why !== 'VERSION') m.joinRetry = REMATCH_RETRY;
      else { m.roomsShake = NAME_SHAKE_T; SFX.deny(); }
    }
  }
  if (m.joinWait > 0) {
    m.joinWait -= dt;
    if (m.joinRetry > 0 && NET.role === 'solo' && (m.joinRetry -= dt) <= 0) netJoin(JOIN_AT_BOOT);
  }
}

// ------------------------------------------------------------ the room
function beginRoom() {
  const m = state.menu;
  m.screen = 'room';
  m.rseat = -1; m.rword = 1; m.rkeys = false; m.ropt = -1;
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
  const labels = NET.isClient ? ['LEAVE', 'READY'] : ['LEAVE', 'START'];
  // the room's options under the title, a name and its value each: the
  // world's two are fixed once the room is open (a world grows at load),
  // TEAMS and BOTS stay the host's to change (edit)
  const opts = [];
  let ox = x;
  for (const key of HP_OPTS) {
    const label = HP_NAMES[key], value = roomOptValue(key), vx = ox + pixelTextWidth(label) + 6, vw = pixelTextWidth(value);
    opts.push({ key, label, value, lx: ox, x: vx, y: 34, w: vw, h: 5, edit: NET.role === 'host' && (key === 'teams' || key === 'bots') });
    ox = vx + vw + 16;
  }
  return { x, w, colW, cols, seats, words: roomWords(labels), labels, opts };
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
// the room's code as it sits top-right (a Steam lobby's id has none)
function roomCode() {
  const c = String((NET.transport && NET.transport.room) || '');
  return c.length <= 6 ? c : '';
}
function roomCodeRect(L) {
  const w = pixelTextWidth(roomCode(), 2);
  return { x: L.x + L.w - w, y: 16, w, h: 10 };
}
function roomHit() {
  const L = roomLayout();
  for (let i = 0; i < L.words.length; i++) if (inRect(L.words[i], 3)) return { kind: 'word', w: L.labels[i] };
  if (roomCode() && inRect(roomCodeRect(L), 3)) return { kind: 'code' };
  for (const o of L.opts) if (o.edit && inRect(o, 3)) return { kind: 'opt', key: o.key };
  for (const s of L.seats) if (inRect(s)) {
    // the host's hand on a bot's class mark turns its class
    if (NET.role === 'host' && s.p.control === 'ai' && seatsOpen() && inRect(roomClsRect(s), 2)) return { kind: 'seat', id: s.p.id, act: 'cls' };
    const act = seatAct(s, mouse.x >= s.x + s.w - RS_TOOL);
    return act ? { kind: 'seat', id: s.p.id, act } : null;
  }
  return null;
}
// the code onto the clipboard, for a Discord message; it flashes white as it goes
function roomCopy() {
  const code = roomCode();
  try { if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {}); } catch (e) { }
  state.menu.copyAt = performance.now() / 1000; // the flash's start, on the frame clock
  SFX.place();
}
function roomDo(h) {
  if (!h) return;
  if (h.kind === 'code') { roomCopy(); return; }
  if (h.kind === 'opt') { roomOpt(h.key, 1); return; }
  if (h.kind === 'word') {
    if (h.w === 'LEAVE') leaveRoom();
    else if (h.w === 'START') roomStart();
    else if (h.w === 'READY') { netReady(!NET.ready.has(localId)); SFX.place(); }
    return;
  }
  if (h.act === 'swap') { netSeat(h.id); SFX.place(); }
  else if (h.act === 'cls') { seatClass(h.id); SFX.pickup(); }
  else if (h.act === 'kick') { seatKick(h.id); SFX.deny(); }
  else { seatBot(h.id); SFX.pickup(); }
}
// a seat's class mark, where a click on a bot's turns its class
function roomClsRect(s) { return { x: s.x + s.w - RS_CLS - 2, y: s.y + 9, w: 16, h: 16 }; }
function roomClick() {
  if (state.menu.screen === 'host') { hostClick(); return; }
  if (state.menu.roomsT < 1) return;
  roomDo(roomHit());
}
// the keys walk a cursor over the ten seats (left/right across the rule)
// and down onto the words; Enter does what a click there would
function roomKey(k) {
  if (state.menu.screen === 'host') { hostKey(k); return; }
  const m = state.menu, L = roomLayout();
  m.rkeys = true;
  if (k === 'escape' || k === 'backspace') { leaveRoom(); return; }
  const d = moveDir(k);
  const eds = L.opts.filter((o) => o.edit);
  if (m.ropt >= 0) { // the options row: left/right walk it, Enter or a turn changes it, down goes back to the seats
    if (d === 'down') { m.ropt = -1; m.rseat = L.seats[0].p.id; SFX.pickup(); }
    else if ((d === 'left' || d === 'right') && eds.length) { m.ropt = (m.ropt + (d === 'right' ? 1 : eds.length - 1)) % eds.length; SFX.pickup(); }
    else if (k === 'enter' || k === ' ') roomOpt(eds[m.ropt].key, 1);
    return;
  }
  const at = L.seats.findIndex((s) => s.p.id === m.rseat);
  if (d === 'up' && at >= 0 && L.seats[at].k === 0 && eds.length) { m.rseat = -1; m.ropt = 0; SFX.pickup(); return; }
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
// an option's value as the room reads it: TEAMS is the seats each side has
// filled, yours first (the host can thin one side by hand)
function roomOptValue(key) {
  if (key === 'map') return mapName(MAP_TYPE);
  if (key === 'valley') return String(SEED);
  if (key === 'bots') return AI_LEVELS[roomLevel()].name;
  const mine = player ? player.team : 0, n = (t) => roomSide(t).filter((p) => p.active).length;
  return n(mine) + 'V' + n(1 - mine);
}
// the host turns TEAMS or BOTS one step (d = 1 up, -1 down, round the end)
function roomOpt(key, d) {
  if (NET.role !== 'host' || !seatsOpen()) return;
  if (key === 'bots') { const n = AI_LEVELS.length; setAiLevel(((settings.aiLevel | 0) + d + n) % n); netHostRoster(); return; }
  if (key !== 'teams') return;
  // never fewer seats than a side has people in
  const n = (t) => roomSide(t).filter((p) => p.active).length, ppl = (t) => roomSide(t).filter(isHuman).length;
  const lo = Math.max(1, ppl(0), ppl(1)), cur = Math.max(n(0), n(1));
  let k = cur + d;
  if (k > HP_TEAM_MAX) k = lo; else if (k < lo) k = HP_TEAM_MAX;
  seatsSize(k);
  SFX.pickup();
}
// every person in the room has said READY (the host's own word is START)
function roomAllReady() { return players.every((p) => p.control !== 'remote' || NET.ready.has(p.id)); }
// the bots' level the room plays: the host's own setting, a guest's copy of it
function roomLevel() { return NET.isClient ? NET.aiLevel : settings.aiLevel | 0; }
function leaveRoom() {
  netLeave(); // a host's room closes under everyone in it; a guest walks out of one
  beginRooms();
}
// the host's START: every screen into the match, together
function roomStart() {
  if (NET.role !== 'host') return;
  if (!roomAllReady()) { // the seats it waits on flash, and nothing starts
    for (const p of players) if (p.control === 'remote' && !NET.ready.has(p.id)) state.menu.cardFx[p.id] = 0.6;
    SFX.deny();
    return;
  }
  // no pick for now (Noah, 2026-10-14): every class as it came, and the
  // eagle at once - a guest's screen follows the host's into the drop
  const m = state.menu;
  m.pressT = 0.12; m.csel = player.cls; m.countN = 0;
  lockIn();
}

// ------------------------------------------------------------ the host page
// CREATE's page, League's "create a custom game": the room's options before
// the room exists, one row each, its value between two chevrons - MAP (the
// valley's shape, MAPS), VALLEY (its seed: either chevron rolls another),
// TEAMS (seats a side; the rest are emptied, seatsSize) and BOTS (their
// level). BACK, and CREATE: on this page's own world the room opens at once;
// another shape or seed is a page, since a world grows at load, so the page
// comes back hosting on it and opens the room (rematchBootHost, which
// carries TEAMS over). TEAMS and BOTS stay the host's to turn in the room.
const HP_OPTS = ['map', 'valley', 'teams', 'bots'];
const HP_NAMES = { map: 'MAP', valley: 'VALLEY', teams: 'TEAMS', bots: 'BOTS' };
const HP_WORDS = ['BACK', 'CREATE'];
const HP_Y = 62, HP_ROW = 24;   // the first row's top and the rows' pitch
const HP_VAL_X = 150;           // the values' chevrons start this far in
const HP_TEAM_MAX = 5;          // a side's seats (MAX_PLAYERS / 2)
function beginHost() {
  const m = state.menu;
  m.screen = 'host';
  m.hostMap = MAP_TYPE; m.hostSeed = SEED; // this page's world: CREATE opens at once unless one is turned
  if (!m.hostSize) m.hostSize = HP_TEAM_MAX;
  m.hsel = 0; m.hword = 1; m.rkeys = false; // the keys start on the first row
  SFX.place();
}
function hostValue(key) {
  const m = state.menu;
  if (key === 'map') return mapName(m.hostMap);
  if (key === 'valley') return String(m.hostSeed);
  if (key === 'teams') return m.hostSize + 'V' + m.hostSize;
  return AI_LEVELS[settings.aiLevel | 0].name;
}
function hostStep(key, d) {
  const m = state.menu;
  if (key === 'map') m.hostMap = (m.hostMap + d + MAPS.length) % MAPS.length;
  else if (key === 'valley') { const s = m.hostSeed; do m.hostSeed = rollSeed(); while (m.hostSeed === s); }
  else if (key === 'teams') m.hostSize = (m.hostSize - 1 + d + HP_TEAM_MAX) % HP_TEAM_MAX + 1;
  else { const n = AI_LEVELS.length; setAiLevel(((settings.aiLevel | 0) + d + n) % n); return; } // setAiLevel sounds itself
  SFX.pickup();
}
function hostLayout() {
  const x = RM_X, w = VIEW_W - RM_X * 2, vx = x + HP_VAL_X, vw = x + w - 8 - vx;
  const rows = HP_OPTS.map((key, i) => {
    const y = HP_Y + i * HP_ROW, h = HP_ROW - 4;
    return { key, x, y, w, h, l: { x: vx, y, w: 20, h }, r: { x: vx + vw - 20, y, w: 20, h }, vx, vw };
  });
  return { x, w, rows, words: roomWords(HP_WORDS) };
}
// a word, a row's left chevron (d -1) or the rest of a row (d 1)
function hostHit() {
  const L = hostLayout();
  for (let i = 0; i < L.words.length; i++) if (inRect(L.words[i], 3)) return { kind: 'word', i };
  for (let i = 0; i < L.rows.length; i++) if (inRect(L.rows[i])) return { kind: 'row', i, d: inRect(L.rows[i].l) ? -1 : 1 };
  return null;
}
function hostWord(i) {
  if (HP_WORDS[i] === 'BACK') { SFX.pickup(); beginRooms(); return; }
  state.menu.pressT = 0.12;
  hostGo();
}
function hostGo() {
  const m = state.menu;
  if (m.hostMap === MAP_TYPE && m.hostSeed === SEED) { hostRoom(); seatsSize(m.hostSize); return; }
  try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ size: m.hostSize })); } catch (e) { }
  roomsFeedClose();
  location.href = location.pathname + '?map=' + m.hostMap + '&seed=' + m.hostSeed + '&net=host&back=1' + (netSteam() ? '&transport=steam' : '');
  m.hostGoing = true; // nothing more on this page while the next one loads
}
function hostClick() {
  const m = state.menu;
  if (m.roomsT < 1 || m.hostGoing) return;
  const h = hostHit();
  if (!h) return;
  if (h.kind === 'word') { hostWord(h.i); return; }
  m.hsel = h.i;
  hostStep(HP_OPTS[h.i], h.d);
}
// up/down walk the rows and onto the words, left/right turn a row (or walk
// the words), Enter turns a row on or does the word
function hostKey(k) {
  const m = state.menu, n = HP_OPTS.length;
  if (m.hostGoing) return;
  m.rkeys = true;
  if (k === 'escape' || k === 'backspace') { hostWord(0); return; }
  const d = moveDir(k);
  if (d === 'up') { m.hsel = m.hsel < 0 ? n - 1 : Math.max(0, m.hsel - 1); SFX.pickup(); }
  else if (d === 'down') { m.hsel = m.hsel < 0 || m.hsel >= n - 1 ? -1 : m.hsel + 1; SFX.pickup(); }
  else if (d === 'left' || d === 'right') {
    if (m.hsel >= 0) hostStep(HP_OPTS[m.hsel], d === 'right' ? 1 : -1);
    else { m.hword = 1 - m.hword; SFX.pickup(); }
  } else if (k === 'enter' || k === ' ') { if (m.hsel >= 0) hostStep(HP_OPTS[m.hsel], 1); else hostWord(m.hword); }
}
// the page: the rows on the list's plates, a row's name on its left and its
// value centred between two chevrons, white; gold under the pointer or keys
function renderHost(now, a) {
  const m = state.menu, L = hostLayout();
  const hit = m.roomsT >= 1 && !m.hostGoing ? hostHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPixelTextShadow(ctx, roomTitle(player && player.name), L.x, 18, SC_LIT, SC_INK, 2);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 55, L.w, 1);
  L.rows.forEach((r, i) => {
    const hot = hit ? hit.kind === 'row' && hit.i === i : m.rkeys && m.hsel === i;
    ctx.fillStyle = hot ? SC_HOT : i & 1 ? SC_ROW_B : SC_ROW_A; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (hot) { ctx.fillStyle = SC_GOLD; ctx.fillRect(r.x, r.y, 1, r.h); }
    const ty = r.y + ((r.h - 5) >> 1), val = hostValue(r.key);
    drawPixelText(ctx, HP_NAMES[r.key], r.x + 10, ty, hot ? SC_LIT : SC_LBL, 1);
    const lh = hit && hit.kind === 'row' && hit.i === i && hit.d < 0, rh = hit && hit.kind === 'row' && hit.i === i && hit.d > 0;
    drawHostChevron(r.l.x + 6, ty - 1, -1, lh ? '#ffd95c' : hot ? SC_LBL : SC_EDGE);
    drawHostChevron(r.r.x + 10, ty - 1, 1, rh ? '#ffd95c' : hot ? SC_LBL : SC_EDGE);
    drawPixelText(ctx, val, r.vx + ((r.vw - pixelTextWidth(val, 2)) >> 1), r.y + ((r.h - 10) >> 1), hot ? '#ffd95c' : SC_LIT, 2);
  });
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.i === i : m.rkeys && m.hsel < 0 && m.hword === i;
    drawRoomWord(w, hot);
  }
  ctx.globalAlpha = 1;
}
// a small chevron, 4x7, d -1 pointing left
function drawHostChevron(x, y, d, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) { const dx = d < 0 ? 3 - i : i; ctx.fillRect(x + dx, y + i, 1, 1); ctx.fillRect(x + dx, y + 6 - i, 1, 1); }
}

// ------------------------------------------------------------ the rematch
// League's "play again", relay rooms only (a Steam lobby's id is not ours to
// reopen). A world is grown at load, so a match's valley cannot be played
// twice: the moment a match ends the host rolls the next seed and tells
// every guest (`rematch`, rematchOffer); the host's LOBBY keeps the room's
// code, sides and empty seats and each person's slot by uid for the next
// page (sessionStorage) and reloads as the host of the SAME code on the new
// valley, straight onto the room. A guest's own LOBBY, whenever it presses
// it, reloads onto that seed and joins the code from boot, retrying while
// the host's page is still on its way back, and the host hands it the slot
// it held. The host's leaving does not end a guest's match as HOST LEFT
// once the rematch is heard.
const REMATCH_KEY = 'softfall.rematch';
const REMATCH_WAIT = 180; // s a guest back from a match keeps trying the room's code (the host may still be reading the stats)
const REMATCH_RETRY = 1;  // s between those tries
let rematchCarry = null;  // a reopened room's: { seats: uid -> slot } from the last match

function rematchUrl() {
  const base = location.pathname + '?map=' + MAP_TYPE;
  const code = roomCode();
  if (NET.role === 'host' && code && !netSteam()) {
    const seed = NET.nextSeed || rollSeed();
    NET.transport.send('*', { t: 'rematch', seed, map: MAP_TYPE });
    const seats = {};
    for (const pr of NET.peers.values()) seats[pr.uid] = pr.slot;
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ teams: players.map((p) => p.team), cls: players.map((p) => p.cls), none: players.filter((p) => p.control === 'none').map((p) => p.id), seats })); } catch (e) { }
    return base + '&seed=' + seed + '&net=host&room=' + code + '&back=1';
  }
  if (NET.isClient && NET.rematch) return base.replace(/map=\d+/, 'map=' + NET.rematch.map) + '&seed=' + NET.rematch.seed + '&join=' + NET.rematch.room + '&back=1';
  return null;
}
// the host's, every step: the first step of an ended match picks the next valley
function rematchOffer() {
  if (NET.nextSeed || !(state.over === 'won' || state.over === 'lost') || !roomCode() || netSteam()) return;
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
  if (c) {
    players.forEach((p, i) => { if (c.teams && c.teams[i] !== undefined) p.team = c.teams[i]; });
    for (const id of c.none || []) if (players[id] && players[id] !== player) players[id].control = 'none';
    for (const p of players) if (p !== player && c.cls && c.cls[p.id] != null) setClass(p, c.cls[p.id]); // the bots' classes the host picked (a guest's own comes with its hello)
    rematchCarry = { seats: c.seats || {} };
    if (c.size) seatsSize(c.size); // the host page's TEAMS, on a page it sent here
  }
  beginRoom();
}
function rematchBootJoin() {
  if (/[?&]back=1/.test(location.search)) state.menu.joinWait = REMATCH_WAIT;
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
// a room's name on the list and over the room: its host's game
function roomTitle(name) { return (name || '?') + "'S GAME"; }

function renderRooms(now, a) {
  if (state.menu.screen === 'room') { renderRoom(now, a); return; }
  if (state.menu.screen === 'host') { renderHost(now, a); return; }
  const m = state.menu, L = roomsLayout();
  const hit = m.roomsT >= 1 ? roomsHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPixelTextShadow(ctx, 'CUSTOM GAMES', L.x, 18, SC_LIT, SC_INK, 2);
  if (netSteam()) drawRelayPip(L.x + L.w - 5, 21, m.roomsOk, now);
  else { drawCodeBox(L.box, m, now, hit && hit.kind === 'code'); drawRelayPip(L.box.x - 10, 19, m.roomsOk, now); }
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
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.i === i : (m.rkeys || m.rsel >= 0) && m.rword === i; // a picked row lights JOIN
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
  // READY: a tick after the name (the host's is its START, so it wears none)
  if (!bot && p !== roomHost() && NET.ready.has(p.id)) drawTick(x + 46 + pixelTextWidth(p.name), y + 10, RM_OK);
  drawPixelText(ctx, bot ? 'BOT' : CLASSES[p.cls].name, x + 42, y + 19, SC_DIM, 1);
  const ix = roomClsRect(s).x + 2;
  if (act === 'cls') { ctx.fillStyle = SC_GOLD; ctx.fillRect(ix, y + 25, 12, 1); } // the host's hand on a bot's mark: a gold hairline under it
  ctx.drawImage(classIcon12(p.cls, act === 'cls'), ix, y + 11);
  if (!bot && p !== roomHost()) drawPingBars(ix - 14, y + 13, NET.pings[p.id]); // a guest's link to the host
  if (act === 'swap') drawSwapMark(ix - 32, y + 13, SC_GOLD);
  if (act === 'kick' || act === 'empty') drawXMark(tx, ty, '#e0524f');
}

function renderRoom(now, a) {
  const m = state.menu, L = roomLayout();
  const hit = m.roomsT >= 1 ? roomHit() : null;
  ctx.globalAlpha = a;
  ctx.fillStyle = SC_BG; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const hp = roomHost();
  drawPixelTextShadow(ctx, roomTitle(hp && hp.name), L.x, 16, SC_LIT, SC_INK, 2);
  // the options: names dim, values grey, the two the host can turn white
  // and gold under the pointer or the keys
  const eds = L.opts.filter((o) => o.edit);
  for (const o of L.opts) {
    const hot = (hit && hit.kind === 'opt' && hit.key === o.key) || (!hit && m.ropt >= 0 && eds[m.ropt] === o);
    drawPixelText(ctx, o.label, o.lx, o.y, SC_DIM, 1);
    drawPixelText(ctx, o.value, o.x, o.y, hot ? '#ffd95c' : o.edit ? SC_LIT : SC_LBL, 1);
    if (hot) { ctx.fillStyle = SC_GOLD; ctx.fillRect(o.x, o.y + 7, o.w, 1); }
  }
  // the code a host reads to a friend, gold, with the relay's pip
  // (a click copies it: white for a moment, lit under the pointer)
  const code = roomCode(), cw = code ? pixelTextWidth(code, 2) : 0;
  if (cw) drawPixelText(ctx, code, L.x + L.w - cw, 16, now - (m.copyAt || -9) < 0.5 ? SC_LIT : hit && hit.kind === 'code' ? '#ffd95c' : SC_GOLD, 2);
  drawRelayPip(L.x + L.w - cw - 10, 19, !!(NET.transport && NET.transport.open), now);
  ctx.fillStyle = SC_EDGE; ctx.fillRect(L.x, 46, L.w, 1);
  for (const c of L.cols) {
    const side = TEAMS[skin(c.t)];
    drawPixelText(ctx, side.name, c.x, 56, side.mark, 1);
    const n = roomSide(c.t).filter(isHuman).length + ' / ' + roomSide(c.t).filter((p) => p.active).length; // people over the side's open seats
    drawPixelText(ctx, n, c.x + L.colW - pixelTextWidth(n), 56, SC_DIM, 1);
  }
  for (const s of L.seats) {
    let act = hit && hit.kind === 'seat' && hit.id === s.p.id ? hit.act : null;
    if (!act && m.rseat === s.p.id) act = seatAct(s, false) || 'none'; // the keys' cursor lights the seat too
    drawRoomSeat(s, act === 'none' ? null : act, m.cardFx && m.cardFx[s.p.id] > 0);
    if (m.rseat === s.p.id && !hit) { ctx.fillStyle = SC_GOLD; ctx.fillRect(s.x, s.y, 2, s.h); }
  }
  for (let i = 0; i < L.words.length; i++) {
    const w = L.words[i], hot = hit ? hit.kind === 'word' && hit.w === w.label : m.rkeys && m.rseat < 0 && m.rword === i;
    // START is dim until every person is READY; a guest's READY is green once said
    drawRoomWord(w, hot, w.label === 'START' && !roomAllReady(), w.label === 'READY' && NET.ready.has(localId) ? RM_OK : null);
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
