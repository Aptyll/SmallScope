'use strict';
// ------------------------------------------------------------ history
// MATCH HISTORY, op.gg's list: every match this screen played to its end,
// kept with all ten seats so a row can show both sides and open into the
// whole scoreboard (the profile's MATCH HISTORY tab, js/ui/profile.js).
//
// There is no stats server. Each screen files its own matches at the whistle
// (historyNote, from endMatch beside buildsNote) and keeps the newest
// MH_KEEP through PROFILE.history (js/app/profile.js, the one place that
// touches storage). A record is what the screen saw at the end: a rival's
// numbers are the last the fog let through, the same ones the end screen
// prints. Nothing in the sim reads any of this (CLAUDE.md rule 2).
//
// One record: { m: match id, v: patch, at: ms since 1970 (this machine's
// clock: only ever shown as "how long ago"), mode: PARTY_MODES key, t: whole
// seconds, w: your side won 1/0, you: your seat, lo: your loadout
// "trick,trick,calling", seats: [{ s: seat, tm: team, n: name, p: their pid
// ('' a bot, or a person who sent no card), h: hero NAME
// (by name, so a hero added or removed moves nobody's row), b: 1 for a bot,
// lv, k, d, a, cs, g: gold earned, dmg: to heroes, it: [six item ids or ''] }] }
const MH_KEEP = 200;    // matches a screen keeps, the oldest out first
const MH_NAME = /^[A-Z0-9]{1,16}$/;
const MH_MODES = ['quick', 'ranked', 'onevone', 'guide'];
const MH_NUM_MAX = 1e7; // any count past this is a hand edit, not a match
const MH_AT = (n) => typeof n === 'number' && isFinite(n) && n > 0 && n < 1e14; // a clock reading in ms

// the mode the match was played under: the party's, or 1V1 off the match itself
function historyMode() {
  if (state.onevone) return 'onevone';
  return MH_MODES.indexOf(NET.mode) >= 0 ? NET.mode : 'quick';
}
// A match ends (endMatch, js/sim/player.js; once, on its first win or loss):
// file it. `won` is the local side's result. Practice files nothing.
function historyNote(won) {
  if (PRACTICE) return null;
  const winner = won ? player.team : 1 - player.team;
  const seats = players.filter((p) => p.active && CLASSES[p.cls]).map((p) => ({
    s: p.id, tm: p.team, n: boardName(p), h: CLASSES[p.cls].name, b: isHuman(p) ? 0 : 1,
    p: p === player ? PROFILE.pid() : (NET.cards[p.id] && NET.cards[p.id].pid) || '', // whose card opens off this seat
    lv: p.level | 0, k: p.kills | 0, d: p.deaths | 0, a: p.assists | 0, cs: p.farm | 0,
    g: Math.round(p.earned) | 0, dmg: Math.round(p.dmgOut) | 0,
    it: p.items.slice(0, ITEM_SLOTS).map((id) => id || ''),
  }));
  const m = buildsHash(SEED + '|' + seats.map((q) => q.s + (q.b ? '' : q.n) + q.h + q.tm).join('|'));
  const rec = historyClean({
    m, v: PATCH_TXT.replace(/^PATCH /, ''), at: Date.now(), mode: historyMode(),
    t: Math.max(1, Math.round(state.elapsed)), w: player.team === winner ? 1 : 0, you: player.id,
    lo: [player.loadout.tricks[0], player.loadout.tricks[1], player.loadout.calling].map((x) => x || '').join(','), seats,
  });
  if (!rec) return null;
  const list = PROFILE.history().filter((r) => r.m !== rec.m); // a match is filed once
  list.push(rec);
  PROFILE.putHistory(list.slice(-MH_KEEP));
  return rec;
}

// a record out of storage, checked field by field: anything malformed is
// dropped whole, never half-read
function historyClean(r) {
  const num = (n) => typeof n === 'number' && isFinite(n) && n >= 0 && n <= MH_NUM_MAX;
  if (!r || typeof r !== 'object' || typeof r.m !== 'string' || !/^[0-9a-f]{8}$/.test(r.m)) return null;
  if (typeof r.v !== 'string' || !/^\d\.\d{3}$/.test(r.v) || !MH_AT(r.at) || !num(r.t)) return null;
  if (MH_MODES.indexOf(r.mode) < 0 || (r.w !== 0 && r.w !== 1) || !(r.you >= 0 && r.you < MAX_PLAYERS)) return null;
  if (typeof r.lo !== 'string' || !/^[a-z,]{0,60}$/.test(r.lo) || !Array.isArray(r.seats) || !r.seats.length || r.seats.length > MAX_PLAYERS) return null;
  const seats = [];
  for (const q of r.seats) {
    if (!q || typeof q !== 'object' || !(q.s >= 0 && q.s < MAX_PLAYERS) || (q.tm !== 0 && q.tm !== 1)) return null;
    if (typeof q.n !== 'string' || !MH_NAME.test(q.n) || typeof q.h !== 'string' || !/^[A-Z]{1,16}$/.test(q.h)) return null;
    if (!['lv', 'k', 'd', 'a', 'cs', 'g', 'dmg'].every((k) => num(q[k]))) return null;
    if (!Array.isArray(q.it) || q.it.length > ITEM_SLOTS || !q.it.every((id) => id === '' || (typeof id === 'string' && /^[a-z_0-9]{1,24}$/.test(id)))) return null;
    const pid = typeof q.p === 'string' && /^[0-9a-f]{8}$/.test(q.p) ? q.p : '';
    seats.push({ s: q.s | 0, tm: q.tm, n: q.n, p: pid, h: q.h, b: q.b ? 1 : 0, lv: q.lv | 0, k: q.k | 0, d: q.d | 0, a: q.a | 0, cs: q.cs | 0, g: q.g | 0, dmg: q.dmg | 0, it: q.it.slice() });
  }
  if (!seats.some((q) => q.s === r.you)) return null;
  return { m: r.m, v: r.v, at: Math.floor(r.at), mode: r.mode, t: Math.floor(r.t), w: r.w, you: r.you | 0, lo: r.lo, seats };
}

// ---- what the screens read off it ------------------------------------------
// the newest first, optionally one mode only
function historyList(mode) {
  const all = PROFILE.history();
  const out = [];
  for (let i = all.length - 1; i >= 0; i--) if (!mode || all[i].mode === mode) out.push(all[i]);
  return out;
}
function historyYou(r) { return r.seats.find((q) => q.s === r.you); }
// a side's kills, for the kill share (P/KILL)
function historySideKills(r, team) { return r.seats.reduce((n, q) => n + (q.tm === team ? q.k : 0), 0); }
// per hero over `list`: games, wins, the K/D/A and CS summed, most played first
function historyHeroes(list) {
  const by = new Map();
  for (const r of list) {
    const y = historyYou(r);
    let e = by.get(y.h);
    if (!e) by.set(y.h, (e = { h: y.h, n: 0, w: 0, k: 0, d: 0, a: 0, cs: 0, t: 0 }));
    e.n++; e.w += r.w; e.k += y.k; e.d += y.d; e.a += y.a; e.cs += y.cs; e.t += r.t;
  }
  return [...by.values()].sort((a, b) => b.n - a.n || b.w - a.w);
}
// the people this screen played with most on its own side, by pid (a bot or
// a person who sent no card has none and is left out)
function historyMates(list, n) {
  const by = new Map();
  for (const r of list) {
    const y = historyYou(r);
    for (const q of r.seats) {
      if (!q.p || q.s === r.you || q.tm !== y.tm) continue;
      const e = by.get(q.p) || { pid: q.p, n: q.n, games: 0 };
      e.games++;
      by.set(q.p, e);
    }
  }
  return [...by.values()].sort((a, b) => b.games - a.games).slice(0, n);
}
// "how long ago", the row's clock: minutes, hours, days, weeks
function historyAgo(at, now) {
  const s = Math.max(0, ((now || Date.now()) - at) / 1000);
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'M';
  if (s < 86400) return Math.floor(s / 3600) + 'H';
  if (s < 86400 * 14) return Math.floor(s / 86400) + 'D';
  return Math.floor(s / (86400 * 7)) + 'W';
}
// (K + A) / D, the ratio op.gg prints, a death-free match as its K + A
function historyKda(k, d, a) { return (k + a) / Math.max(1, d); }

// ------------------------------------------------------------ history › cards
// A PLAYER CARD: what one profile tells the others in its party, so any name
// in a party, on an end screen or in a history row can be opened into that
// player's profile (js/ui/profile.js). It rides the join (the hello's `card`,
// and the host's roomInfo to every guest: NET.cards, js/net/net.js), and each
// screen keeps the cards it has heard as its PEOPLE (PROFILE.people): the
// RANKED tab's ladder and the search's names. Nothing checks a card - there is
// no server - so it is only ever shown, never trusted by the match.
// { pid, n: name, pic: hero name, rk: rating, rn: ranked matches, g: matches, w: wins,
//   bd: [badge ids, PF_BADGES in js/ui/profile.js],
//   rec: [the newest MH_CARD_REC as { h, w, mode, k, d, a, t, at }], seen: ms }
const MH_CARD_REC = 10;    // matches a card carries
const MH_CARD_BADGES = 8;  // badge ids a card may name
const MH_PEOPLE_KEEP = 300; // cards a screen keeps, the longest unseen out first
function cardMine() {
  const st = PROFILE.stats();
  const rec = historyList().slice(0, MH_CARD_REC).map((r) => {
    const y = historyYou(r);
    return { h: y.h, w: r.w, mode: r.mode, k: y.k, d: y.d, a: y.a, t: r.t, at: r.at };
  });
  return { pid: PROFILE.pid(), n: PROFILE.name(), pic: profilePic(), rk: PROFILE.rank(), rn: PROFILE.rankedN(), g: st.matches, w: st.wins, bd: pfBadgeIds(), rec };
}
// the picture a profile shows: the one chosen, else the hero last picked
function profilePic() { return PROFILE.pic() || CLASSES[profileHero()].name; }
function peopleClean(c) {
  const num = (n) => typeof n === 'number' && isFinite(n) && n >= 0 && n <= MH_NUM_MAX;
  if (!c || typeof c !== 'object' || typeof c.pid !== 'string' || !/^[0-9a-f]{8}$/.test(c.pid)) return null;
  if (typeof c.n !== 'string' || !MH_NAME.test(c.n) || typeof c.pic !== 'string' || !/^[A-Z]{1,16}$/.test(c.pic)) return null;
  if (!num(c.rk) || !num(c.g) || !num(c.w) || c.w > c.g || !Array.isArray(c.rec) || c.rec.length > MH_CARD_REC) return null;
  const rec = [];
  for (const r of c.rec) {
    if (!r || typeof r.h !== 'string' || !/^[A-Z]{1,16}$/.test(r.h) || (r.w !== 0 && r.w !== 1) || MH_MODES.indexOf(r.mode) < 0) return null;
    if (!['k', 'd', 'a', 't'].every((k) => num(r[k])) || !MH_AT(r.at)) return null;
    rec.push({ h: r.h, w: r.w, mode: r.mode, k: r.k | 0, d: r.d | 0, a: r.a | 0, t: r.t | 0, at: Math.floor(r.at) });
  }
  const bd = Array.isArray(c.bd) ? c.bd.filter((id) => typeof id === 'string' && /^[a-z0-9_]{1,16}$/.test(id)).slice(0, MH_CARD_BADGES) : [];
  return { pid: c.pid, n: c.n, pic: c.pic, rk: Math.floor(c.rk), rn: num(c.rn) ? Math.floor(c.rn) : 0, g: c.g | 0, w: c.w | 0, bd, rec, seen: MH_AT(c.seen) ? Math.floor(c.seen) : 0 };
}
// cards heard (a party's, off the wire): each kept once by pid, the newest
// word on it winning; your own is never a person you met
function peopleNote(cards) {
  if (!Array.isArray(cards)) return;
  let list = PROFILE.people(), changed = false;
  for (const raw of cards) {
    const c = peopleClean(raw);
    if (!c || c.pid === PROFILE.pid()) continue;
    c.seen = Date.now();
    list = list.filter((q) => q.pid !== c.pid);
    list.push(c);
    changed = true;
  }
  if (changed) PROFILE.putPeople(list.sort((a, b) => a.seen - b.seen).slice(-MH_PEOPLE_KEEP));
}
