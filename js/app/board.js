'use strict';
// ------------------------------------------------------------ board
// THE GLOBAL LADDER: every RANKED player on Steam, by rating. One Steam
// leaderboard holds a row a Steam account (desktop/steam-board.js): the
// score is the rating, and the row's details carry that player's card
// (cardMine, js/app/history.js) packed into whole numbers, so a row shows
// the same face, name and record a party's card does and opens into the same
// profile. The hub's LADDER and the profile's RANKED tab read it through
// pfLadder (js/ui/profile-tabs.js); off Steam (a browser, Steam down, the
// board unreachable) they list the people this screen has met, as before.
//
// Like a card, a row is only ever shown, never trusted: there is no server,
// so a player's own screen posts its own rating (boardSync, after a match
// and whenever the ladder is in view and the card changed).
const BOARD_V = 0x53460001;   // 'SF' and the packing's version, the details' first number
const BOARD_TOP = 100;        // rows read from the top of the board
const BOARD_AROUND = 25;      // rows read either side of you
const BOARD_STALE = 60000;    // ms a read stays fresh while the ladder is in view
const BOARD_RETRY = 15000;    // ms after a failed read or post before the next try
const BOARD_TXT = 4;          // whole numbers a name takes: four letters each, sixteen in all
const board = { rows: null, me: '', at: 0, asking: false, posted: '', posting: false, postAt: 0 };

function boardBridge() { const b = window.steamBridge; return b && b.boardRead && b.boardPost ? b : null; }
// a word as 32 bits (FNV-1a): a hero's name or a badge's id, read back by
// hashing the ones this patch knows (an unknown one is dropped, never guessed)
function boardHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h | 0;
}
function boardText(s, out) {
  for (let i = 0; i < BOARD_TXT; i++) {
    let n = 0;
    for (let j = 0; j < 4; j++) n |= (s.charCodeAt(i * 4 + j) & 0x7f || 0) << (8 * j);
    out.push(n);
  }
}
function boardTextAt(d, at) {
  let s = '';
  for (let i = 0; i < BOARD_TXT * 4; i++) { const c = (d[at + (i >> 2)] >>> (8 * (i & 3))) & 0xff; if (!c) break; s += String.fromCharCode(c); }
  return s;
}
// a card as the details' whole numbers (64 at most, k_cLeaderboardDetailsMax):
// [BOARD_V, pid, rk, rn, g, w, name x4, pic x4, badges n, ...badge hashes,
//  matches n, then each match as [hero hash, w | mode << 1 | k << 4 | d << 12 | a << 20, t, at in seconds]]
function boardPack(c) {
  const d = [BOARD_V, parseInt(c.pid, 16) | 0, c.rk, c.rn, c.g, c.w];
  boardText(c.n, d); boardText(c.pic, d);
  const bd = c.bd.slice(0, MH_CARD_BADGES);
  d.push(bd.length); for (const id of bd) d.push(boardHash(id));
  const rec = c.rec.slice(0, MH_CARD_REC), b8 = (n) => Math.max(0, Math.min(255, n | 0));
  d.push(rec.length);
  for (const r of rec) d.push(boardHash(r.h), (r.w & 1) | (Math.max(0, MH_MODES.indexOf(r.mode)) << 1) | (b8(r.k) << 4) | (b8(r.d) << 12) | (b8(r.a) << 20), r.t | 0, Math.floor(r.at / 1000) | 0);
  return d;
}
// the details back into a card, checked the way a heard card is (peopleClean); null when it is not one
function boardUnpack(d) {
  if (!Array.isArray(d) || d.length < 16 || d[0] !== BOARD_V) return null;
  const heroes = new Map(CLASSES.map((k) => [boardHash(k.name), k.name]));
  const badges = new Map(PF_BADGES.map((b) => [boardHash(b.id), b.id]));
  const c = { pid: ('0000000' + (d[1] >>> 0).toString(16)).slice(-8), rk: d[2], rn: d[3], g: d[4], w: d[5], n: boardTextAt(d, 6), pic: boardTextAt(d, 6 + BOARD_TXT), bd: [], rec: [] };
  let i = 6 + 2 * BOARD_TXT;
  const nb = d[i++];
  if (!(nb >= 0 && nb <= MH_CARD_BADGES)) return null;
  for (let j = 0; j < nb; j++) { const id = badges.get(d[i++]); if (id) c.bd.push(id); }
  const nr = d[i++];
  if (!(nr >= 0 && nr <= MH_CARD_REC) || i + 4 * nr > d.length) return null;
  for (let j = 0; j < nr; j++, i += 4) {
    const h = heroes.get(d[i]), f = d[i + 1], mode = MH_MODES[(f >>> 1) & 7];
    if (h && mode) c.rec.push({ h, w: f & 1, mode, k: (f >>> 4) & 255, d: (f >>> 12) & 255, a: (f >>> 20) & 255, t: d[i + 2], at: (d[i + 3] >>> 0) * 1000 });
  }
  return peopleClean(c);
}

// ---- the board's rows, kept fresh while it is in view ------------------------
// post your card when it changed since the last post (a match, a new name or
// picture), then read the board when the last read has gone stale
function boardSync() {
  const b = boardBridge(), now = Date.now();
  if (!b) return;
  if (PROFILE.rankedN() > 0 && !board.posting && now >= board.postAt) {
    const d = boardPack(cardMine()), key = d.join(',');
    if (key !== board.posted) {
      board.posting = true;
      b.boardPost(PROFILE.rank(), d).then((r) => {
        board.posting = false;
        if (r && r.ok) { board.posted = key; board.at = 0; } // your new place: read again
        else board.postAt = Date.now() + BOARD_RETRY;
      }).catch(() => { board.posting = false; board.postAt = Date.now() + BOARD_RETRY; });
      return; // read once the post has landed, so you stand where it put you
    }
  }
  if (board.posting || board.asking || now < board.at) return;
  board.asking = true;
  Promise.all([b.boardRead(BOARD_TOP, BOARD_AROUND), board.me ? board.me : b.info().then((i) => (i && i.id) || '')]).then(([r, me]) => {
    board.asking = false;
    board.me = String(me || '');
    if (!r || !r.ok || !Array.isArray(r.rows)) { board.at = Date.now() + BOARD_RETRY; return; }
    board.rows = r.rows.map((row) => { const c = boardUnpack(row.details); return c && Object.assign(c, { rank: row.rank | 0, sid: String(row.id) }); }).filter(Boolean);
    board.at = Date.now() + BOARD_STALE;
  }).catch(() => { board.asking = false; board.at = Date.now() + BOARD_RETRY; });
}
// the ladder as the board has it, by rank: your own row is your card as it
// stands now (its place the board's), and a ranked you not on it yet comes
// last with no place. null until the board has answered once
function boardList() {
  if (!board.rows) return null;
  const mine = cardMine();
  let found = false;
  const out = board.rows.map((c) => {
    if (c.sid !== board.me && c.pid !== mine.pid) return c;
    if (found) return null; // you, posted from another screen too: once
    found = true;
    return Object.assign({}, mine, { rank: c.rank, sid: c.sid });
  }).filter(Boolean);
  if (!found && mine.rn > 0) out.push(Object.assign({}, mine, { rank: 0 }));
  return out;
}
// one person's card off the board, when it holds them
function boardCard(pid) { return (board.rows && board.rows.find((c) => c.pid === pid)) || null; }
