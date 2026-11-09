// ------------------------------------------------------------ matchmaking
// QUICKPLAY and RANKED meet other parties before bots: the leader's FIND
// MATCH (partyFind, js/ui/rooms.js) puts the party on the list as looking
// (`seek` in the room's data, netHostRoom, js/net/net.js) and reads the
// list (the relay's rooms, or Steam's lobbies) for another party looking in
// the same mode. Of every party looking, the one whose leader's machine is
// fastest hosts the match (`hs`, seekPower: the host runs the whole match for
// ten), the lowest code among equals: it waits, and the others cross over to
// it (seekCross). A
// crossing party's leader tells its guests (`cross`) and every page of it
// reloads onto the host's valley and joins its room with the party's code
// in the hello (CROSS); the host seats the first party that knocks on its
// rival side (crossAdmit) and turns away any other (MATCHED). Once all of
// that party's people are in (or MATCH_GATHER runs out), or once
// MATCH_WAIT passes with nobody found, the empty seats on both sides go to
// bots and everyone goes on to the hero select (partyStart). A crossed
// page remembers its own party (homeParty): after the match, a refusal, or
// its host walking out, it goes back to it - its leader hosting the party's
// code again and its guests joining it, all on one valley read off that
// code (homeSeed), so nobody has to tell anyone which.
const MATCH_WAIT = 8;     // s a party looks for another before bots fill the rival side
const MATCH_HOLD = 6;     // s more it waits after seeing a party that may be crossing to it
const MATCH_GATHER = 20;  // s a crossing party's people have to arrive before their empty seats go to bots
const MATCH_JOIN = 6;     // s a crossing page keeps trying the room it crossed to before it goes home
const HOME_KEY = 'softfall.home';
const POWER_ROUNDS = 4;   // rounds of seekPower's fixed load (10 encodes each); the fastest counts
const POWER_STEP = 4;     // steps per doubling of speed: machines within ~19% of each other tie, and the code decides
// a page that reloaded to cross into another party's room: that party's
// code and how many people it brings (the hello carries both)
const CROSS = (function () {
  const q = /[?&]party=([A-Z0-9]+)/i.exec(location.search), n = /[?&]pn=([0-9]+)/.exec(location.search);
  return q ? { party: q[1].toUpperCase(), n: n ? parseInt(n[1], 10) : 1 } : null;
})();
// ...and its own party: { code, lead, mode, seats } (seats: a leader's guests, uid -> slot)
let homeParty = null;
if (CROSS) { try { homeParty = JSON.parse(sessionStorage.getItem(HOME_KEY) || 'null'); } catch (e) { } }

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
// which of two looking parties hosts: the faster machine, then the lower code
function seekHosts(power, code, r) { const p = +(r.data && r.data.hs) || 0; return power !== p ? power > p : code < seekKey(r); }
// the parties on the list looking in our mode right now, ours left out
function seekRivals() {
  const mine = roomCode();
  return state.menu.rooms.filter((r) => roomOk(r) && r.data.seek === NET.mode && r.data.state === 'open' &&
    !+r.data.practice && seekKey(r) && seekKey(r) !== mine);
}
// FIND MATCH in QUICKPLAY or RANKED: the party starts looking. False when it
// cannot (no relay, no Steam): bots at once, as before
function seekStart() {
  if (NET.role !== 'host' || NET.mode === 'practice' || NET.mode === 'guide' || !roomCode() || !(NET.transport && NET.transport.open)) return false; // FIRST MATCH goes straight to bots
  seekPower(); // timed now, at the press, not mid-look
  NET.seek = { t: 0, hold: MATCH_WAIT, rival: null, crossing: false };
  roomsFeedOpen();
  netHostRoster(); netHostRoom();
  SFX.place();
  return true;
}
// the leader's second press: the party stops looking (not once a party is on its way in)
function seekCancel() {
  if (!NET.seek || NET.seek.rival || NET.seek.crossing) { SFX.deny(); return; }
  NET.seek = null;
  roomsFeedClose();
  netHostRoster(); netHostRoom();
  SFX.pickup();
}
// the leader's, every step while looking
function updateSeek(dt) {
  const s = NET.seek;
  if (!s || NET.role !== 'host' || s.crossing) return;
  if (!seatsOpen()) { NET.seek = null; roomsFeedClose(); return; }
  s.t += dt;
  if (s.rival) { // a party is coming in: go once all its people are, or at the gather's end
    s.rival.t += dt;
    if (crossedIn() >= s.rival.n || s.rival.t > MATCH_GATHER) seekGo();
    return;
  }
  const mine = roomCode(), rivals = seekRivals();
  let top = null; // the rival that would host over every other rival
  for (const r of rivals) if (!top || seekHosts(+r.data.hs || 0, seekKey(r), top)) top = r;
  if (top && !seekHosts(seekPower(), mine, top)) { seekCross(top); return; }
  if (top) s.hold = Math.max(s.hold, s.t + MATCH_HOLD); // a party we host over may be on its way here
  if (s.t >= s.hold) seekGo();
}
function seekGo() {
  NET.seek = null;
  roomsFeedClose();
  partyStart();
}
// the people of the party that crossed in
function crossedIn() { let n = 0; for (const pr of NET.peers.values()) if (pr.cross) n++; return n; }
// the host's door for a crossing party's hello: the first one looking in
// is seated, and only its people after it
function crossAdmit(msg) {
  const s = NET.seek;
  if (!s || s.crossing || NET.mode === 'practice' || state.mode !== 'title' || NET.phase !== 'room') return false;
  if (!s.rival) { s.rival = { code: String(msg.party), n: Math.max(1, Math.min(5, msg.pn | 0)), t: 0 }; roomsFeedClose(); }
  return s.rival.code === String(msg.party);
}
// our party goes to the lower one: the guests told, every page onto its valley
function seekCross(r) {
  const s = NET.seek, seats = {};
  s.crossing = true;
  roomsFeedClose();
  for (const pr of NET.peers.values()) seats[pr.uid] = pr.slot;
  const code = roomCode(), n = partySize(), seed = +r.data.seed;
  homeSave({ code, lead: true, mode: NET.mode, seats });
  if (NET.peers.size) NET.transport.send('*', { t: 'cross', room: r.room, seed, code, n });
  practiceGo(crossUrl(r.room, seed, code, n));
}
// a guest told its party is crossing: after it
function crossHeard(msg) {
  if (state.mode !== 'title' || !msg.code) return;
  homeSave({ code: String(msg.code), lead: false, mode: NET.mode, seats: {} });
  practiceGo(crossUrl(String(msg.room), msg.seed | 0, String(msg.code), msg.n | 0));
}
function crossUrl(room, seed, code, n) {
  const steam = netSteam() ? '&transport=steam' : '';
  return location.pathname + '?seed=' + seed + '&join=' + room + '&back=1&party=' + code + '&pn=' + n + steam;
}
function homeSave(h) { try { sessionStorage.setItem(HOME_KEY, JSON.stringify(h)); } catch (e) { } }
// the valley a crossed party goes home to, read off its code and the valley
// it crossed to: the leader and every guest land on the same one
function homeSeed(code) {
  let h = SEED;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 100003;
  return 100 + (h % 900);
}
// where a crossed page goes back to: its leader hosting the code again with
// its guests' seats kept, a guest joining it (rematchUrl, partyLost, partyGiveUp)
function crossHomeUrl() {
  const h = homeParty, steam = netSteam() ? '&transport=steam' : '';
  const base = location.pathname + '?seed=' + homeSeed(h.code);
  try { sessionStorage.removeItem(HOME_KEY); } catch (e) { }
  if (h.lead) {
    try { sessionStorage.setItem(REMATCH_KEY, JSON.stringify({ mode: h.mode, seats: h.seats || {} })); } catch (e) { }
    return base + '&net=host&back=1' + steam + (steam ? '&code=' : '&room=') + h.code;
  }
  return base + '&join=' + h.code + '&back=1' + steam;
}
function crossHome() { if (!state.fade) practiceGo(crossHomeUrl()); }
// a guest whose host walked out or showed it out: home, if this page crossed;
// a party of its own otherwise (updateTitle, js/ui/menu.js)
function partyLost() {
  if (homeParty) { crossHome(); return; }
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
  if (NET.isHost) return NET.seek ? NET.seek.t : null;
  return NET.seekAt == null ? null : performance.now() / 1000 - NET.seekAt;
}
function seekText(t) { const s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
