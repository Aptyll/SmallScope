// ------------------------------------------------------------ room talk
// What the waiting room (js/ui/rooms.js) says between people: a few lines of
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
// INVITE (a Steam lobby only: a relay room has its code to copy) opens
// Steam's friends overlay on this lobby. A friend's invite taken up, or
// Steam's Join Game on a friend in a room, reloads this page onto that lobby
// (`joinRequested` from desktop/main.js, or `+connect_lobby` at launch,
// which main.js turns into ?join=); the join from boot does the rest.
//
// THE NUDGE (roomAttention): a screen not in focus when someone joins, a
// chat line lands or the count to the match starts flashes in the taskbar
// (the wrapper's `flash`) or, in a browser, marks its tab's title until it
// is looked at.
const TALK_KEEP = 4;       // lines the room shows
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
// the host's: a line from slot, kept and handed to every screen
function talkHeard(slot, s) {
  s = talkClean(s);
  if (!s) return;
  talkAdd(slot, s);
  if (NET.peers.size) NET.transport.send('*', { t: 'said', slot, s });
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
// the plate and the lines over it, at the foot of the seats
function talkLayout(L) {
  const y = VIEW_H - 36 - 12 - TALK_H;
  return { x: L.x, y, w: L.w, h: TALK_H, top: y - TALK_KEEP * TALK_PITCH - 2 };
}
function drawTalk(L, now, hot) {
  const m = state.menu, T = talkLayout(L);
  NET.chat.forEach((c, i) => {
    const y = T.y - (NET.chat.length - i) * TALK_PITCH - 2, nm = c.name + ':';
    drawPixelText(ctx, nm, T.x + 2, y, TEAMS[skin(c.team)].mark, 1);
    drawPixelText(ctx, c.s, T.x + 2 + pixelTextWidth(nm) + 5, y, SC_TXT, 1);
  });
  ctx.fillStyle = m.talkOn ? '#c89a3c' : hot ? SC_LBL : SC_EDGE; ctx.fillRect(T.x, T.y, T.w, T.h);
  ctx.fillStyle = m.talkOn ? SC_YOU : SC_PLATE; ctx.fillRect(T.x + 1, T.y + 1, T.w - 2, T.h - 2);
  if (m.talkOn) {
    drawPixelText(ctx, m.talk, T.x + 5, T.y + 4, SC_LIT, 1);
    if (Math.floor(now * 2.5) % 2) { ctx.fillStyle = SC_GOLD; ctx.fillRect(T.x + 6 + pixelTextWidth(m.talk), T.y + 3, 1, 7); }
    return;
  }
  // at rest: the key that starts a line, and a speech bubble
  drawKeyCap(ctx, T.x + 3, T.y + 1, 'ENTER', false, hot);
  const bx = T.x + 9 + pixelTextWidth('ENTER') + 6, by = T.y + 3;
  ctx.fillStyle = hot ? SC_LIT : SC_DIM;
  ctx.fillRect(bx + 1, by, 7, 1); ctx.fillRect(bx, by + 1, 1, 3); ctx.fillRect(bx + 8, by + 1, 1, 3); ctx.fillRect(bx + 1, by + 4, 7, 1);
  ctx.fillRect(bx + 2, by + 5, 1, 1); ctx.fillRect(bx + 1, by + 6, 1, 1);
}

// ------------------------------------------------------------ invite
// INVITE sits where a relay room's code would, top-right: a Steam lobby's
function roomInviteRect(L) {
  if (!netSteam() || !NET.transport || !NET.transport.lobbyId) return null;
  const w = pixelTextWidth('INVITE', 2);
  return { x: L.x + L.w - w, y: 16, w, h: 10 };
}
function roomInvite() {
  const b = window.steamBridge;
  if (b && b.invite && NET.transport && NET.transport.lobbyId) { b.invite(NET.transport.lobbyId); SFX.place(); } else SFX.deny();
}
// a friend's invite taken up while the game runs: onto that lobby, unless
// this screen hosts people of its own (leaving would end their room)
function steamJoinRequested(id) {
  if (!id || (NET.role === 'host' && NET.peers.size) || (NET.transport && NET.transport.lobbyId === id)) { SFX.deny(); return; }
  location.search = '?join=' + id + '&transport=steam';
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
