// ------------------------------------------------------------ matchmaking
// RANKED fills a match from whoever is looking before
// bots: the leader's PLAY (partyFind, js/ui/rooms.js) puts the party on
// the list as looking (`seek` in the room's data, netHostRoom, js/net/net.js)
// with how full each side of its room is (`fill`: people seated and seats
// held for a party on its way in) and how well it hosts (`hs`, seekScore),
// and reads the list (the relay's rooms, or Steam's lobbies of this patch
// that look in this mode) for every other party looking.
//
// Every looking leader packs that one list the same way (seekPlan): the
// rooms already taking parties in (`hub`) first, fullest first, then the
// rest best host first (`hs`, the lowest code among equals); each party in
// turn goes into the first room before it that can still split every
// party in it, its own whole on one side, into two sides of three (seekSplit),
// else it hosts a room of its own. So six solo players looking at once
// make one 3v3 with no bots, and eight make a 3v3 and a room of two.
// A leader whose plan names another room crosses to it (seekCross): it tells
// its guests (`cross`), and every page of it leaves its own room and joins
// that one in place, no reload, the party's code and size in the hello
// (CROSS). The host seats a party
// that knocks while every party can still be split (crossAdmit), dealing
// the sides again when it must (seekDeal: no one changes seat, only which
// side a seat is on, before the hero select), holding the party's seats
// until all of it is in or MATCH_GATHER runs out, and turns away one that
// no longer fits (MATCHED). A party turned away, or whose host walks out
// before the match, goes home and looks again (crossHome, seekResume): no
// party is ever left out of the search by a race. The host starts once
// both sides are full, or once MATCH_WAIT (and MATCH_HOLD after the last
// party it saw coming) has passed, and never later than MATCH_MAX; the
// empty seats on both sides go to bots and everyone goes on to the hero
// select (partyStart). A crossed page remembers its own party (homeParty):
// after the match it goes back to it - its leader hosting the party's code
// again and its guests joining it.
//
// Who hosts: the host's machine runs the whole match for six and uploads
// every snapshot, so `hs` is its machine's speed (seekPower) less how often
// it fell behind its people when it last hosted (PROFILE.hostLag, measured
// by netHostLag, js/net/net.js): a machine whose upload could not keep up
// stops being picked. On Steam a party also first looks only at rooms its
// ping estimate puts within MATCH_PING (each room lists its leader's ping
// location, `pl`), widening to any room after MATCH_NEAR.
const MATCH_WAIT = 8;     // s a room looks before bots fill it, with nobody on the way
const MATCH_HOLD = 6;     // s more it waits after the last party it saw coming (one the plan sends here, or one that came in)
const MATCH_MAX = 30;     // s a room looks at most, however many keep coming; it takes no party past it
const MATCH_GATHER = 20;  // s a crossing party's people have to arrive before their held seats go back
const MATCH_JOIN = 6;     // s a crossing page keeps trying the room it crossed to before it goes home
const MATCH_NEAR = 20;    // s a party looks only at rooms within MATCH_PING (Steam's estimate) before it takes any
const MATCH_PING = 150;   // ms: a room further than this is passed over while the search is young
const MATCH_RESUME = 10;  // s a leader turned away waits for its guests to come home before it looks again
const MATCH_LEAVE = 0.6;  // s a crossing leader stays after telling its guests, so `cross` reaches them before its room closes
const POWER_ROUNDS = 4;   // rounds of seekPower's fixed load (10 encodes each); the fastest counts
const POWER_STEP = 4;     // steps per doubling of speed: machines within ~19% of each other tie, and the code decides
const HOST_LAG_W = 40;    // seekScore steps a machine that always fell behind as host loses: more than any CPU gap
// a page crossing into another party's room: that party's code and how
// many people it brings (the hello carries both), null otherwise
let CROSS = null;
// ...and its own party: { code, lead, mode, seats, t } (seats: a leader's guests, uid -> slot; t: the search's seconds so far)
let homeParty = null;
let crossHomeDue = null; // a trip home asked for under a fade: taken once it clears (crossHome)

function seekKey(r) { return String((r.data && r.data.code) || r.room || '').toUpperCase(); }
// how well this machine can host, as a small whole number every party reads
// the same way off the list: a fixed load (a match-sized delta of made-up
// bodies) through the host's own encoder, timed once a page. Higher hosts
let seekPowerMemo = null;
function seekPower() {
  if (seekPowerMemo !== null) return seekPowerMemo;
  const ents = [];
  for (let i = 0; i < 120; i++) ents.push([i, { x: i * 3.25, y: 900 - i * 1.5, vx: 0.5, vy: -1.25, hp: 40 + i, dir: 'down', animT: i / 7, moving: true, team: i & 1, kit: { a: i, b: [1, 2, 3] } }]);
  const msg = { t: 'snap', d: { v: 2, tick: 1, base: 0, R: { ch: ents } } };
  let best = Infinity;
  for (let k = 0; k < POWER_ROUNDS; k++) { const t = performance.now(); for (let j = 0; j < 10; j++) snapEncode(msg, encDict(), 0); best = Math.min(best, performance.now() - t); }
  seekPowerMemo = Math.max(0, Math.round(Math.log2(500 / Math.max(best, 0.01)) * POWER_STEP));
  return seekPowerMemo;
}
// what the list says of how well this leader hosts: the machine's speed, less
// its record of falling behind as a host (0 never, or never measured; 1 always)
function seekScore() { return seekPower() - Math.round(PROFILE.hostLag() * HOST_LAG_W); }
// a listed room's parties: how many people each brings, seated or on the
// way (`grp`; Steam's store hands it back as text)
function seekGrpOf(r) {
  let g = r.data && r.data.grp;
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { g = null; } }
  return Array.isArray(g) ? g.map((n) => Math.max(0, n | 0)).filter((n) => n > 0) : [];
}
// the people a crossing party has brought in so far
function seekArrived(code) { let n = 0; for (const pr of NET.peers.values()) if (pr.cross === code) n++; return n; }
// this room's sides: the people seated, and the seats held for the parties still on their way
function seekFill() {
  const f = [0, 0], s = NET.seek, gone = new Set();
  for (const pr of NET.peers.values()) if (pr.gone) gone.add(pr.slot); // sent on to another room (seekSend)
  for (const p of players) if (isHuman(p) && !gone.has(p.id)) f[p.team]++;
  if (s && s.parties) for (const [code, pt] of s.parties) f[pt.side] += Math.max(0, pt.n - seekArrived(code));
  return f;
}
// every party in this room as { n, side, pt }: our own (the leader and the
// friends who came by its code) first, then each that crossed in
function seekGroups() {
  const s = NET.seek, own = { n: 1, side: player.team, pt: null };
  for (const pr of NET.peers.values()) if (!pr.cross) own.n++;
  const g = [own];
  if (s && s.parties) for (const pt of s.parties.values()) g.push({ n: pt.n, side: pt.side, pt });
  return g;
}
// The one packing rule, the host's door and every plan alike: the sides
// each party takes so that every party sits whole on one side and neither
// side passes `cap` - null when no split works. Of the splits that work, the
// one that moves the fewest people already placed (a party's `side`; one
// without is new), our own party last; then the one that leaves the biggest
// gap open, so a bigger party coming later still fits. A room has at most
// six parties: every split is tried
function seekSplit(groups, cap) {
  let best = null, cost = Infinity;
  for (let m = 0; m < 1 << groups.length; m++) {
    const f = [0, 0];
    let moved = 0;
    groups.forEach((g, i) => { const t = (m >> i) & 1; f[t] += g.n; if (g.side != null && g.side !== t) moved += g.n + (i === 0 ? 0.5 : 0); });
    if (f[0] > cap || f[1] > cap) continue;
    const c = moved * 100 - Math.max(cap - f[0], cap - f[1]);
    if (c < cost) { cost = c; best = groups.map((g, i) => (m >> i) & 1); }
  }
  return best;
}
// a friend joining the leader's party by its code while it looks: room for
// one more in our own party, the sides dealt again if they must be
function seekGrowOwn() {
  const groups = seekGroups();
  groups[0].n++;
  const sides = seekSplit(groups, partyCap(NET.mode));
  if (!sides) return false;
  seekDeal(groups, sides);
  return true;
}
// the match starts and nobody else is coming: the people spread as evenly
// over the two sides as whole parties allow (two leftover solos one a side,
// not together against three bots), moving the fewest to get there
function seekEven() {
  const groups = seekGroups(), cap = partyCap(NET.mode);
  let best = null, cost = Infinity;
  for (let m = 0; m < 1 << groups.length; m++) {
    const f = [0, 0];
    let moved = 0;
    groups.forEach((g, i) => { const t = (m >> i) & 1; f[t] += g.n; if (g.side !== t) moved += g.n + (i === 0 ? 0.5 : 0); });
    if (f[0] > cap || f[1] > cap) continue;
    const c = Math.abs(f[0] - f[1]) * 100 + moved;
    if (c < cost) { cost = c; best = groups.map((g, i) => (m >> i) & 1); }
  }
  if (best) seekDeal(groups, best);
}
// whether every party of these sizes splits into two sides of `cap`
function seekFits(sizes, cap) { return !!seekSplit(sizes.map((n) => ({ n, side: null })), cap); }
// the sides dealt again to a split: each party's side set, every person's
// seat moved to its party's side, and the seats nobody holds shared out so
// each side keeps its half of the room. No one changes seat: only which
// side a seat is on, and only while the party waits (crossAdmit, netHostHello)
function seekDeal(groups, sides) {
  groups.forEach((g, i) => { if (g.pt) g.pt.side = sides[i]; });
  const own = sides[0], half = players.length / 2, side = new Map([[localId, own]]);
  for (const pr of NET.peers.values()) {
    if (pr.gone) { side.set(pr.slot, players[pr.slot].team); continue; } // sent on (seekSend) and on its way out: its seat stays as it is
    const pt = pr.cross && NET.seek.parties.get(pr.cross);
    side.set(pr.slot, pt ? pt.side : own);
  }
  const left = [half, half];
  for (const [slot, t] of side) { players[slot].team = t; left[t]--; }
  // the empty seats: held first for the parties on their way, then the rest
  const want = [0, 0];
  for (const [code, pt] of NET.seek.parties) want[pt.side] += Math.max(0, pt.n - seekArrived(code));
  for (const p of players) {
    if (side.has(p.id)) continue;
    const t = want[0] > 0 && left[0] > 0 ? 0 : want[1] > 0 && left[1] > 0 ? 1 : left[0] > 0 ? 0 : 1;
    p.team = t; left[t]--; if (want[t] > 0) want[t]--;
  }
}
// the parties on the list looking in our mode right now, ours left out
function seekRivals() {
  const mine = roomCode();
  return state.menu.rooms.filter((r) => roomOk(r) && r.data.seek === NET.mode && r.data.state === 'open' &&
    seekKey(r) && seekKey(r) !== mine);
}
// one looking party as the plan reads it
function seekEntry(r) {
  const grp = seekGrpOf(r);
  return { code: seekKey(r), r, grp, n: grp.reduce((a, b) => a + b, 0), hs: +r.data.hs || 0, hub: +r.data.hub > 0, pl: String(r.data.pl || '') };
}
function seekMine() { const grp = seekGroups().map((g) => g.n); return { code: roomCode(), r: null, grp, n: grp.reduce((a, b) => a + b, 0), hs: seekScore(), hub: NET.seek.parties.size > 0, me: true }; }
// the plan's order: rooms taking parties in first, the fullest first; then
// the best host, then the lowest code
function seekOrder(a, b) {
  if (a.hub !== b.hub) return a.hub ? -1 : 1;
  if (a.hub && a.n !== b.n) return b.n - a.n;
  if (a.hs !== b.hs) return b.hs - a.hs;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}
// is this room near enough for our party to cross to it now
function seekNear(e) {
  const s = NET.seek;
  if (e.me || !e.pl || s.t >= MATCH_NEAR) return true;
  const ms = s.pings.get(e.pl);
  return ms == null || ms < 0 || ms <= MATCH_PING; // not measured yet (or not measurable): taken
}
// The one packing every looking leader runs on the list: which room our
// party ends in, and which other parties the plan sends to ours. Each, in
// seekOrder, goes into the first room before it whose parties and its own
// still split into two sides (seekFits: a room already taking parties in
// merges into a fuller one, every party in it moving on its own) - else it
// hosts. Crossing only ever goes up the
// order, so no two rooms cross to each other.
function seekPlan() {
  const cap = partyCap(NET.mode), me = seekMine();
  const all = [me].concat(seekRivals().map(seekEntry)).sort(seekOrder);
  const rooms = [];
  for (const e of all) {
    let into = null;
    for (const g of rooms) {
      if (e.me && !seekNear(g.host)) continue;
      if (seekFits(g.grp.concat(e.grp), cap)) { into = g; break; }
    }
    if (into) { into.grp = into.grp.concat(e.grp); into.comers.push(e); e.into = into; continue; }
    e.into = { host: e, grp: e.grp.slice(), comers: [] };
    rooms.push(e.into);
  }
  return { me, room: me.into, rooms };
}
// what the Steam list is asked for while this party looks (steamRooms): only
// the parties looking in our mode, near ones first while the search is young
function seekAsk() { return NET.seek ? { seek: NET.mode, near: NET.seek.t < MATCH_NEAR } : {}; }
// the ping to each listed leader's location, asked of Steam once a location (an answer of -1: not measurable)
function seekPings() {
  const s = NET.seek, b = window.steamBridge;
  if (!netSteam() || !b || typeof b.pingTo !== 'function') return;
  for (const r of seekRivals()) {
    const pl = String(r.data.pl || '');
    if (!pl || s.pings.has(pl)) continue;
    s.pings.set(pl, null);
    b.pingTo(pl).then((ms) => { s.pings.set(pl, typeof ms === 'number' ? ms : -1); }, () => s.pings.set(pl, -1));
  }
}
// this leader's ping location for the list (Steam only; '' until Steam has one)
let seekLoc = '';
function seekLocAsk() {
  const b = window.steamBridge;
  if (seekLoc || !netSteam() || !b || typeof b.pingLoc !== 'function') return;
  b.pingLoc().then((l) => { if (typeof l === 'string' && l && l !== seekLoc) { seekLoc = l; netHostRoom(); } }, () => { });
}
// PLAY in RANKED: the party starts looking. False
// when it cannot (no relay, no Steam): bots at once, as before. `base` is
// the seconds an earlier search ran, for a party back from a room that
// turned it away (seekResume): its clock carries on
function seekStart(base) {
  if (NET.role !== 'host' || NET.mode === 'guide' || !roomCode() || !(NET.transport && NET.transport.open)) return false; // FIRST MATCH goes straight to bots
  seekPower(); // timed now, at the press, not mid-look
  seekLocAsk();
  NET.seek = { t: 0, base: base || 0, hold: MATCH_WAIT, parties: new Map(), crossing: false, pings: new Map() };
  roomsFeedOpen();
  netHostRoster(); netHostRoom();
  SFX.place();
  return true;
}
// the leader's second press: the party stops looking (not once a party is on its way in)
function seekCancel() {
  if (!NET.seek || NET.seek.parties.size || NET.seek.crossing) { SFX.deny(); return; }
  NET.seek = null;
  roomsFeedClose();
  netHostRoster(); netHostRoom();
  SFX.pickup();
}
// the leader's, every step while looking
function updateSeek(dt) {
  const s = NET.seek;
  if (!s || NET.role !== 'host') return;
  if (s.crossing) { if ((s.crossing.t -= dt) <= 0) crossGo(s.crossing.room, s.crossing.code, s.crossing.n); return; }
  if (!seatsOpen()) { NET.seek = null; roomsFeedClose(); return; }
  s.t += dt;
  seekPings();
  let coming = false, moved = false;
  for (const [code, pt] of s.parties) {
    pt.t += dt;
    const got = seekArrived(code);
    if (got > pt.got) { pt.got = got; s.hold = Math.max(s.hold, s.t + MATCH_HOLD); }
    if (got < pt.n && pt.t > MATCH_GATHER) { pt.n = got; moved = true; } // the rest never came: their seats go back
    if (got < pt.n) coming = true;
  }
  if (moved) netHostRoom();
  const cap = partyCap(NET.mode), fill = seekFill();
  if (coming) return; // a party on its way in is waited for (MATCH_GATHER at most)
  if (fill[0] >= cap && fill[1] >= cap) { seekGo(); return; } // both sides full: no bots
  if (s.t < MATCH_MAX) {
    const plan = seekPlan();
    if (plan.room.host !== plan.me) { seekCross(plan.room.host.r); return; }
    const give = seekGive(plan, cap);
    if (give) seekSend(give.room, give.codes);
    if (plan.room.comers.length) s.hold = Math.max(s.hold, s.t + MATCH_HOLD); // the plan sends parties here: they may be on their way
  }
  if (s.t >= Math.min(s.hold, MATCH_MAX)) seekGo();
}
function seekGo() {
  seekEven();
  NET.seek = null;
  roomsFeedClose();
  partyStart();
}
// the host's door for a crossing party's hello: the side its party sits on,
// or -1 to turn it away. A party's first knock holds seats for all of it,
// the sides dealt again if every party only splits another way (seekSplit,
// seekDeal); its people after that take them
function crossAdmit(msg) {
  const s = NET.seek;
  if (!s || s.crossing || state.mode !== 'title' || NET.phase !== 'room') return -1;
  const code = String(msg.party || ''), cap = partyCap(NET.mode);
  let pt = s.parties.get(code);
  if (!pt) {
    if (s.t >= MATCH_MAX) return -1; // about to start: no more
    const n = Math.max(1, Math.min(cap, msg.pn | 0)), groups = seekGroups();
    pt = { n, side: null, t: 0, got: 0 };
    groups.push({ n, side: null, pt });
    const sides = seekSplit(groups, cap);
    if (!sides) return -1;
    s.parties.set(code, pt);
    seekDeal(groups, sides);
    s.hold = Math.max(s.hold, s.t + MATCH_HOLD);
  }
  return pt.side;
}
// our room goes to the one the plan names: every guest told, and once they
// have had MATCH_LEAVE to hear it the leader goes too (updateSeek, crossGo).
// Each page knocks there as its own party: our friends under our code, and
// in a room merging into a fuller one each party that crossed in here under
// its own code again, so the host seats every party whole
function seekCross(r) {
  const s = NET.seek, seats = {}, code = roomCode();
  let n = 1;
  for (const pr of NET.peers.values()) if (!pr.cross) { seats[pr.uid] = pr.slot; n++; }
  s.crossing = { room: r.room, t: MATCH_LEAVE, code, n };
  netHostRoom(); // off the list as looking, so no plan counts it
  roomsFeedClose();
  homeParty = { code, lead: true, mode: NET.mode, seats, t: seekClock() || 0 };
  for (const [peer, pr] of NET.peers) {
    const pt = pr.cross ? s.parties.get(pr.cross) : null;
    NET.transport.send(peer, { t: 'cross', room: r.room, code: pr.cross || code, n: pt ? pt.n : n });
  }
}
// A room that cannot merge whole into a fuller one (five people and three)
// may still finish it: the parties that crossed in here and fill that
// room's last seats exactly, with every party there still split whole, are
// sent on to it (seekSend) and the rest of this room looks on. Only a
// match made full, never a part move that leaves both short
function seekGive(plan, cap) {
  const s = NET.seek, mine = [];
  for (const [code, pt] of s.parties) if (seekArrived(code) >= pt.n) mine.push({ code, n: pt.n }); // whole parties only
  if (!mine.length) return null;
  for (const g of plan.rooms) {
    if (g === plan.room) break; // only rooms before ours: fuller ones
    if (!g.host.hub || !seekNear(g.host)) continue;
    const need = 2 * cap - g.grp.reduce((a, b) => a + b, 0);
    if (need <= 0) continue;
    for (let m = 1; m < 1 << mine.length; m++) {
      const pick = mine.filter((_, i) => (m >> i) & 1);
      if (pick.reduce((a, p) => a + p.n, 0) === need && seekFits(g.grp.concat(pick.map((p) => p.n)), cap)) return { room: g.host.r, codes: pick.map((p) => p.code) };
    }
  }
  return null;
}
// those parties told to cross to that room (`cross`, each under its own
// code) and let go here: off this room's count at once, so no plan counts
// them twice
function seekSend(r, codes) {
  const s = NET.seek;
  for (const [peer, pr] of NET.peers) {
    if (!codes.includes(pr.cross)) continue;
    NET.transport.send(peer, { t: 'cross', room: r.room, code: pr.cross, n: s.parties.get(pr.cross).n });
    pr.gone = true;
  }
  for (const c of codes) s.parties.delete(c);
  netHostRoom();
}
// a guest told its room is crossing: after it (a friend of the leader now
// has a party to go home to; a page that crossed in keeps its own)
function crossHeard(msg) {
  if (state.mode !== 'title' || !msg.code) return;
  if (!homeParty) homeParty = { code: String(msg.code), lead: false, mode: NET.mode, seats: {} };
  crossGo(String(msg.room), String(msg.code), msg.n | 0);
}
// this page out of its party's room and into the one crossed to, in place:
// the join a typed code makes, its hello naming the party (netClientPoll's
// hello, js/net/net.js), tried for MATCH_JOIN before it goes home (updateRooms)
function crossGo(room, code, n) {
  const m = state.menu, mode = NET.mode;
  roomsFeedClose();
  netLeave();
  NET.mode = mode;
  CROSS = { party: code, n: Math.max(1, n) };
  netJoin(room);
  m.screen = 'room'; m.joining = true; m.joinWait = MATCH_JOIN; m.joinTo = room; m.seek = null;
  SFX.place();
}
// where a crossed page goes back to: its leader hosting the code again with
// its guests' seats kept, a guest joining it (rematchUrl, partyLost,
// partyGiveUp). `again`: the party never got its match (turned away, or its
// host walked out first), so its leader looks again once home (seekResume)
function crossHomeUrl(again) {
  const h = homeParty, steam = netSteam() ? '&transport=steam' : '';
  const base = location.pathname + '?back=1';
  if (h.lead) {
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: h.mode, seats: h.seats || {}, seek: again ? +h.t || 0 : null })); } catch (e) { }
    return base + '&net=host' + steam + (steam ? '&code=' : '&room=') + h.code;
  }
  return base + '&join=' + h.code + steam;
}
function crossHome(again) {
  if (state.fade) { crossHomeDue = !!again; return; }
  crossHomeDue = null;
  if (again && crossHomeHere()) return;
  pageGo(crossHomeUrl(again));
}
// a player who crossed alone and was turned away (or lost the host) before
// any match: no page to reload and no friends to gather, so it hosts a room
// of its own right here and looks again at once, its clock carrying on
// (seekResume). A reload's few seconds were long enough for a lone room
// elsewhere to give up on it and start with bots
function crossHomeHere() {
  const h = homeParty;
  if (!h || !h.lead || Object.keys(h.seats || {}).length || state.mode !== 'title') return false;
  const m = state.menu, t = +h.t || 0;
  homeParty = null; CROSS = null;
  m.joining = false; m.joinWait = 0; m.joinRetry = 0; m.joinTo = null;
  netLeave();
  beginParty('ranked');
  rematchCarry = { seats: {}, seek: t };
  return true;
}
// a leader home from a room that turned it away: once its guests are back
// in their seats (or MATCH_RESUME has passed) it looks again, its clock
// carrying on, every guest still READY from the first press
function seekResume(dt) {
  if (crossHomeDue != null && !state.fade) crossHome(crossHomeDue);
  const c = rematchCarry;
  if (!c || c.seek == null || NET.role !== 'host' || NET.seek || state.menu.screen !== 'room' || !seatsOpen() || !(NET.transport && NET.transport.open)) return;
  c.wait = (c.wait || 0) + dt;
  if (Object.keys(c.seats).length && c.wait < MATCH_RESUME) return;
  const base = c.seek;
  c.seek = null;
  for (const p of players) if (p.control === 'remote') NET.ready.add(p.id);
  seekStart(base);
}
// a guest whose host walked out or showed it out: home, if this page crossed;
// a party of its own otherwise (updateTitle, js/ui/menu.js)
function partyLost() {
  if (homeParty) { crossHome(true); return; } // before the match: home, and the leader looks again
  if (popOpen()) leavePop();
  const m = state.menu;
  // a join turned away here (a code typed again after a kick) ends as the
  // refusal in updateRooms does: the box shakes, and the join is over - left
  // standing, it hid every seat and held PLAY shut
  if (m.joining) m.codeShake = NAME_SHAKE_T;
  m.joining = false; m.joinWait = 0; m.joinRetry = 0;
  netLeave();
  beginParty('ranked');
  SFX.deny();
}
// the party looking: the seconds since PLAY, the leader's own or a
// guest's copy off the roster; null while it is not
function seekClock() {
  if (NET.isHost) return NET.seek ? NET.seek.base + NET.seek.t : null;
  return NET.seekAt == null ? null : performance.now() / 1000 - NET.seekAt;
}
function seekText(t) { const s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
