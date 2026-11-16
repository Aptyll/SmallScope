// ------------------------------------------------------------ room talk
// What the party lobby (js/ui/rooms.js) says between people: a few lines of
// chat under the seats, the Steam friends' invite, a Steam invite taken up,
// and the nudge a screen gives when it is tabbed out and the room needs it.
//
// THE CHAT: the last TALK_KEEP lines over a plate at the foot of the seats,
// each a name in its side's paint and the words. Enter (with the keys not
// walking the seats) or a click on the plate starts a line, Enter sends it,
// Esc drops it. A guest's line goes to the host (`say`), who keeps the list
// and hands every line round (`said`), its own included; the host drops a
// guest's lines that come faster than TALK_GAP. Only what the pixel font
// draws gets through (talkClean). The list lives in NET.chat and starts
// empty with every room.
//
// INVITE: in a Steam lobby an empty seat's + opens Steam's friends overlay
// on it (every party has its code to copy as well; one friend at a time from
// the social column, js/ui/friends.js). A friend's invite taken up, or
// Steam's Join Game on a friend anywhere out of a match, reloads this page
// onto that lobby (`joinRequested` from desktop/main.js, or `+connect_lobby`
// at launch, which main.js turns into ?join=), its party with it when this
// screen leads one (steamJoinRequested); the join from boot does the rest.
//
// THE NUDGE (roomAttention): a screen not in focus when someone joins, a
// chat line lands or the count to the match starts flashes in the taskbar
// (the wrapper's `flash`) or, in a browser, marks its tab's title until it
// is looked at.
const TALK_KEEP = 6;       // lines kept: the champ select shows them all, the party TALK_ROOM
const TALK_ROOM = 4;       // lines the party shows
const TALK_MAX = 48;       // characters a line may carry
const TALK_GAP = 0.4;      // s a guest's lines must stand apart
const TALK_PITCH = 9;      // px between lines
const TALK_H = 12;         // the plate's height
let talkTitle = null;      // the tab's own title while it wears the nudge's mark

// the room's words in the pixel font's letters, one space between words
function talkClean(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9 .,!?'\-:]/g, '').replace(/\s+/g, ' ').trim().slice(0, TALK_MAX); }
function talkAdd(slot, s) {
  const p = players[slot];
  if (!p || !s) return;
  NET.chat.push({ name: p.name || '?', team: p.team, s });
  while (NET.chat.length > TALK_KEEP) NET.chat.shift();
  if (slot !== localId) { SFX.pickup(); roomAttention(); }
}
// the host's: a line from slot, kept and handed to every screen - in the
// champ select (the draft is on) only to the speaker's own side, League's
function talkHeard(slot, s) {
  s = talkClean(s);
  if (!s || !players[slot]) return;
  const side = DRAFT.phase !== 'off' ? players[slot].team : -1;
  if (side < 0 || side === player.team) talkAdd(slot, s);
  for (const [peer, pr] of NET.peers) if (side < 0 || (players[pr.slot] && players[pr.slot].team === side)) NET.transport.send(peer, { t: 'said', slot, s });
}
// the host's: a guest's `say`, unless it came too soon after its last
function talkFrom(pr, s) {
  const now = performance.now() / 1000;
  if (now - (pr.sayAt || -9) < TALK_GAP) return;
  pr.sayAt = now;
  talkHeard(pr.slot, s);
}
// a line from this screen: the host's goes round at once, a guest's to the host
function talkSay(s) {
  s = talkClean(s);
  if (!s) return;
  if (NET.isClient) NET.transport.send('host', { t: 'say', s });
  else talkHeard(localId, s);
}
// the room's keys, first: true when the chat took the key
function talkKey(k, e) {
  const m = state.menu;
  if (!m.talkOn) {
    if (k !== 'enter' || m.rkeys) return false;
    talkOpen();
    return true;
  }
  const ch = e && e.char && e.char.length === 1 ? e.char.toUpperCase() : '';
  if (k === 'escape') m.talkOn = false;
  else if (k === 'enter') { talkSay(m.talk); m.talkOn = false; }
  else if (k === 'backspace') m.talk = m.talk.slice(0, -1);
  else if (m.talk.length < TALK_MAX && (ch === ' ' ? m.talk && !m.talk.endsWith(' ') : ch && talkClean(ch) === ch)) m.talk += ch;
  return true;
}
function talkOpen() {
  const m = state.menu;
  m.talkOn = true; m.talk = '';
  SFX.pickup();
}
// the plate and the lines over it: where L puts it (L.ty; the party's
// bottom-left corner, roomLayout's L.talk, as tall as the button beside it:
// L.th; its lines may run L.cw wide; the champ select's bottom left with
// L.lines lines), or at the foot of the screen
function talkLayout(L) {
  const y = L.ty != null ? L.ty : VIEW_H - 36 - 12 - TALK_H, n = L.lines || TALK_ROOM;
  return { x: L.x, y, w: L.w, h: L.th || TALK_H, cw: L.cw || L.w, n, top: y - n * TALK_PITCH - 2 };
}
function inTalk(L) { return overRect(talkLayout(L), 2, 2); }
function drawTalk(L, now, hot) {
  const m = state.menu, T = talkLayout(L), lines = NET.chat.slice(-T.n);
  ctx.save(); ctx.beginPath(); ctx.rect(T.x, T.top - 2, T.cw, T.y - T.top + 2); ctx.clip(); // a long line stops at its edge
  lines.forEach((c, i) => {
    const y = T.y - (lines.length - i) * TALK_PITCH - 2, nm = c.name + ':';
    drawPixelText(ctx, nm, T.x + 2, y, TEAMS[skin(c.team)].mark, 1);
    drawPixelText(ctx, c.s, T.x + 2 + pixelTextWidth(nm) + 5, y, SC_TXT, 1);
  });
  ctx.restore();
  ctx.fillStyle = m.talkOn ? '#c89a3c' : hot ? SC_LBL : SC_EDGE; ctx.fillRect(T.x, T.y, T.w, T.h);
  ctx.fillStyle = m.talkOn ? SC_YOU : SC_PLATE; ctx.fillRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2);
  if (m.talkOn) {
    let t = m.talk;
    while (t && pixelTextWidth(t) > T.w - 12) t = t.slice(1); // a long line scrolls: its end stays in view
    const ty = T.y + ((T.h - 5) >> 1);
    drawPixelText(ctx, t, T.x + 5, ty, SC_LIT, 1);
    if (Math.floor(now * 2.5) % 2) { ctx.fillStyle = SC_GOLD; ctx.fillRect(T.x + 6 + pixelTextWidth(t), ty - 1, 1, 7); }
    return;
  }
  // at rest: the key that starts a line, and a speech bubble
  const ky = T.y + ((T.h - 10) >> 1);
  drawKeyCap(ctx, T.x + 3 + (T.h > TALK_H ? 3 : 0), ky, 'ENTER', false, hot);
  const bx = T.x + 9 + (T.h > TALK_H ? 3 : 0) + pixelTextWidth('ENTER') + 6, by = ky + 2;
  ctx.fillStyle = hot ? SC_LIT : SC_DIM;
  ctx.fillRect(bx + 1, by, 7, 1); ctx.fillRect(bx, by + 1, 1, 3); ctx.fillRect(bx + 8, by + 1, 1, 3); ctx.fillRect(bx + 1, by + 4, 7, 1);
  ctx.fillRect(bx + 2, by + 5, 1, 1); ctx.fillRect(bx + 1, by + 6, 1, 1);
}

// ------------------------------------------------------------ invite
// An empty seat's + in a Steam lobby: Steam's friends overlay on this lobby
function roomInvite() {
  const b = window.steamBridge;
  if (b && b.invite && NET.transport && NET.transport.lobbyId) { b.invite(NET.transport.lobbyId); SFX.place(); } else SFX.deny();
}
// A friend's party taken up while the game runs (their invite, Join Game on
// them, their row's gold step, their card's JOIN): this page reloads onto
// that lobby, from any menu, the party screen or the practice field - never
// out of a match or a hero select under way, where it would walk out on nine
// others. A leader with friends brings them along (Noah's call, 2026-11-16):
// each guest is told (`follow`) and follows FOLLOW_LAG behind, so the
// leader's hello lands first, when the two parties fit in one side's seats
// (the friend's party's count off their presence or their invite). When
// they cannot fit, the leader goes alone and the guests fall back to
// parties of their own, as when any leader leaves.
const FOLLOW_LAG = 1.2;    // s a guest's page takes to follow its leader across
function partyFreeToGo() { return PRACTICE || (state.mode === 'title' && NET.phase === 'room' && !CROSS); }
function steamJoinRequested(id) {
  if (!id || state.fade || (NET.transport && NET.transport.lobbyId === id)) { SFX.deny(); return; }
  if (!partyFreeToGo()) { if (state.mode === 'title') SFX.deny(); return; } // in a match the invite waits in Steam's chat
  if (NET.role === 'host' && NET.peers.size && partyFollowFits(id)) NET.transport.send('*', { t: 'follow', lobby: id });
  location.search = '?join=' + id + '&transport=steam';
}
// whether this party and the one in lobby id fit one side together: what
// the friends list or the invite card says of theirs (nothing known: try)
function partyFollowFits(id) {
  const f = FRIENDS.list.find((q) => q.lobby === id) || (FRIENDS.card && FRIENDS.card.lobby === id ? FRIENDS.card : null);
  return (f ? f.n | 0 : 0) + partySize() <= partyCap(f && f.mode);
}
// a guest told its leader is taking the party into a friend's: after it
function followHeard(msg) {
  const id = String((msg && msg.lobby) || '');
  if (!/^\d+$/.test(id) || !partyFreeToGo() || state.fade) return;
  NET.rematch = { room: '', gone: true }; // the leader's lobby closing behind it is not a host walking out (netClientPoll)
  practiceGo(location.pathname + '?join=' + id + '&transport=steam', FOLLOW_LAG);
}
if (window.steamBridge && window.steamBridge.onEvent) window.steamBridge.onEvent((ev) => { if (ev && ev.t === 'joinRequested') steamJoinRequested(String(ev.lobby || '')); });

// ------------------------------------------------------------ the nudge
function roomAttention() {
  if (document.hasFocus()) return;
  const b = window.steamBridge;
  if (b && b.flash) { b.flash(); return; }
  if (talkTitle === null) { talkTitle = document.title; document.title = '* ' + talkTitle; }
}
pageListen(window, 'focus', () => { if (talkTitle !== null) { document.title = talkTitle; talkTitle = null; } });
