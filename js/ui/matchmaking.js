// ------------------------------------------------------------ matchmaking
// QUICKPLAY, RANKED and 1V1 fill a match from whoever is looking before
// bots: the leader's FIND MATCH (partyFind, js/ui/rooms.js) puts the party on
// the list as looking (`seek` in the room's data, netHostRoom, js/net/net.js)
// with how full each side of its room is (`fill`: people seated and seats
// held for a party on its way in) and how well it hosts (`hs`, seekScore),
// and reads the list (the relay's rooms, or Steam's lobbies of this patch
// that look in this mode) for every other party looking.
//
// Every looking leader packs that one list the same way (seekPlan): the
// rooms already taking parties in (`hub`) first, fullest first, then the
// rest best host first (`hs`, the lowest code among equals); each party in
// turn goes into the first room before it with a side it fits on
// (seekSide: the emptier side, a party whole on one side, never past five),
// else it hosts a room of its own. So ten solo players looking at once
// make one 5v5 with no bots, and twelve make a 5v5 and a room of two.
// A leader whose plan names another room crosses to it (seekCross): it tells
// its guests (`cross`), and every page of it leaves its own room and joins
// that one in place, no reload, the party's code and size in the hello
// (CROSS). The host seats a party
// that knocks on the side it fits (crossAdmit), holding the party's seats
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
// Who hosts: the host's machine runs the whole match for ten and uploads
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
// a listed room's sides, people seated and seats held (Steam's store hands it back as text)
function seekFillOf(r) {
  let f = r.data && r.data.fill;
  if (typeof f === 'string') { try { f = JSON.parse(f); } catch (e) { f = null; } }
  return Array.isArray(f) && f.length === 2 ? [Math.max(0, f[0] | 0), Math.max(0, f[1] | 0)] : [0, 0];
}
// the people a crossing party has brought in so far
function seekArrived(code) { let n = 0; for (const pr of NET.peers.values()) if (pr.cross === code) n++; return n; }
// this room's sides: the people seated, and the seats held for the parties still on their way
function seekFill() {
  const f = [0, 0], s = NET.seek;
  for (const p of players) if (isHuman(p)) f[p.team]++;
  if (s && s.parties) for (const [code, pt] of s.parties) f[pt.side] += Math.max(0, pt.n - seekArrived(code));
  return f;
}
// the side a party of n takes in a room filled `fill`: the emptier one it
// fits on whole (side 1 on a tie), or -1 when it fits on neither. The host
// seats by this and every plan predicts by it, so both agree
function seekSide(fill, n, cap) {
  const order = fill[0] < fill[1] ? [0, 1] : [1, 0];
  for (const t of order) if (fill[t] + n <= cap) return t;
  return -1;
}
// the parties on the list looking in our mode right now, ours left out
function seekRivals() {
  const mine = roomCode();
  return state.menu.rooms.filter((r) => roomOk(r) && r.data.seek === NET.mode && r.data.state === 'open' &&
    !+r.data.practice && seekKey(r) && seekKey(r) !== mine);
}
// one looking party as the plan reads it
function seekEntry(r) {
  const fill = seekFillOf(r);
  return { code: seekKey(r), r, fill, n: fill[0] + fill[1], hs: +r.data.hs || 0, hub: +r.data.hub > 0, pl: String(r.data.pl || '') };
}
function seekMine() { const fill = seekFill(); return { code: roomCode(), r: null, fill, n: fill[0] + fill[1], hs: seekScore(), hub: NET.seek.parties.size > 0, me: true }; }
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
// how a room filled `add` fits into one filled `fill`: 0 side to side, 1
// crossed over, -1 not at all (the way that leaves the sides closer first)
function seekFits(fill, add, cap) {
  const ways = [0, 1].filter((w) => fill[0] + add[w] <= cap && fill[1] + add[1 - w] <= cap);
  if (ways.length < 2) return ways.length ? ways[0] : -1;
  const gap = (w) => Math.abs(fill[0] + add[w] - fill[1] - add[1 - w]);
  return gap(1) < gap(0) ? 1 : 0;
}
// The one packing every looking leader runs on the list: which room our
// party ends in, and which other parties the plan sends to ours. Each, in
// seekOrder, goes into the first room before it that it fits - a party on
// a side whole (seekSide), a room already taking parties in with both its
// sides (seekFits: a smaller room merges into a fuller one, every party in
// it moving on its own) - else it hosts. Crossing only ever goes up the
// order, so no two rooms cross to each other.
function seekPlan() {
  const cap = partyCap(NET.mode), me = seekMine();
  const all = [me].concat(seekRivals().map(seekEntry)).sort(seekOrder);
  const rooms = [];
  for (const e of all) {
    let into = null, way = -1;
    for (const g of rooms) {
      if (e.me && !seekNear(g.host)) continue;
      way = e.hub ? seekFits(g.fill, e.fill, cap) : seekSide(g.fill, e.n, cap);
      if (way >= 0) { into = g; break; }
    }
    if (into) {
      if (e.hub) { into.fill[0] += e.fill[way]; into.fill[1] += e.fill[1 - way]; } else into.fill[way] += e.n;
      into.comers.push(e); e.into = into; continue;
    }
    e.into = { host: e, fill: e.fill.slice(), comers: [] };
    rooms.push(e.into);
  }
  return { me, room: me.into };
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
// FIND MATCH in QUICKPLAY, RANKED or 1V1: the party starts looking. False
// when it cannot (no relay, no Steam): bots at once, as before. `base` is
// the seconds an earlier search ran, for a party back from a room that
// turned it away (seekResume): its clock carries on
function seekStart(base) {
  if (NET.role !== 'host' || NET.mode === 'practice' || NET.mode === 'guide' || !roomCode() || !(NET.transport && NET.transport.open)) return false; // FIRST MATCH goes straight to bots
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
    if (plan.room.comers.length) s.hold = Math.max(s.hold, s.t + MATCH_HOLD); // the plan sends parties here: they may be on their way
  }
  if (s.t >= Math.min(s.hold, MATCH_MAX)) seekGo();
}
function seekGo() {
  NET.seek = null;
  roomsFeedClose();
  partyStart();
}
// the host's door for a crossing party's hello: the side its party sits on,
// or -1 to turn it away. A party's first knock holds seats for all of it on
// the side it fits (seekSide); its people after that take them
function crossAdmit(msg) {
  const s = NET.seek;
  if (!s || s.crossing || NET.mode === 'practice' || state.mode !== 'title' || NET.phase !== 'room') return -1;
  const code = String(msg.party || ''), cap = partyCap(NET.mode);
  let pt = s.parties.get(code);
  if (!pt) {
    if (s.t >= MATCH_MAX) return -1; // about to start: no more
    const n = Math.max(1, Math.min(cap, msg.pn | 0)), side = seekSide(seekFill(), n, cap);
    if (side < 0) return -1;
    pt = { n, side, t: 0, got: 0 };
    s.parties.set(code, pt);
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
  practiceGo(crossHomeUrl(again));
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
  const mode = NET.mode, m = state.menu;
  // a join turned away here (a code typed again after a kick) ends as the
  // refusal in updateRooms does: the box shakes, and the join is over - left
  // standing, it hid every seat and held FIND MATCH shut
  if (m.joining) m.codeShake = NAME_SHAKE_T;
  m.joining = false; m.joinWait = 0; m.joinRetry = 0;
  netLeave();
  beginParty(mode || 'quick');
  SFX.deny();
}
// the party looking: the seconds since FIND MATCH, the leader's own or a
// guest's copy off the roster; null while it is not
function seekClock() {
  if (NET.isHost) return NET.seek ? NET.seek.base + NET.seek.t : null;
  return NET.seekAt == null ? null : performance.now() / 1000 - NET.seekAt;
}
function seekText(t) { const s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
