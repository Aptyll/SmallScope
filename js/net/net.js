// ------------------------------------------------------------ net roles
// Which of the three roles THIS screen plays in a match, and the transport it
// speaks through (docs/pvp-architecture.md). `solo` is a host with no peers:
// the sim runs here, nothing is serialized, and the transport is the loopback
// below, which is why double-clicking index.html keeps working - with no
// bridge to Steam there is no other role to be. A `host` runs the sim for its
// peers and sends snapshots (js/net/snapshot.js); a `client` runs no step at
// all and applies what the host sends. Everything that asks "am I the one
// simulating?" reads NET.isHost, never the role string, so solo and host
// share every branch.
const NET = {
  role: 'solo',              // 'solo' | 'host' | 'client'
  get isHost() { return this.role !== 'client'; },
  get isClient() { return this.role === 'client'; },
  transport: null,           // set by netSetup(); the five-call interface below
  peers: new Map(),          // a host's: transport peer id -> { slot, uid, name, ack, dictAt, q, lastTick } - q: its inputs waiting their step; lastTick: the newest one stepped; ack: the newest tick that client applied (its delta is cut from there); dictAt: tick -> the dictionary's length after that tick's message to it
  fulls: 0,                  // a host's: how many full syncs it has sent (a join, a resync, an ack aged out of the ring)
  lossOut: 0, dropped: 0,    // a host's proof switch: the fraction of snapshot sends thrown away before the transport (DBG.netLoss), and how many were
  parked: new Map(),         // a host's: uid -> slot, for a peer that dropped and may come back
  kicked: new Set(),         // a host's: the uids shown out of this room, refused if they knock again (seatKick)
  ready: new Set(),          // the waiting room's: the slots whose person has said READY (the host's to keep; a guest mirrors it off each roster)
  pings: [],                 // the waiting room's: ms to the host per slot, null for a bot or the host itself (pingsHost; a guest mirrors it)
  aiLevel: 0,                // a guest's: the host's bot level, shown in the room (the host reads roomLevel, js/ui/rooms.js)
  mode: null,                // the party's mode: 'quick' | 'ranked' (PARTY_MODES, js/ui/rooms.js), null with no party open; a guest's comes with the roster
  botLv: null,               // a host's: RANKED's bots' level, pinned at FIND MATCH (rankLevel); null leaves it settings.aiLevel (aiProfile, js/ai/ai-skill.js)
  ranks: [],                 // the party's: each person's RANKED rating per slot (their hello's, the host's own PROFILE.rank)
  code: '',                  // a guest's: the party's code, as the host sent it (roomCode, js/ui/rooms.js)
  pingT: 0,                  // a host's: s toward the next round of pings
  chat: [],                  // the waiting room's last lines, { name, team, s } (js/ui/roomtalk.js)
  hostSlot: 0,               // a client's: which slot the host's own player sits in
  phase: 'room',             // the party's page, the host's to turn: 'room' (the seats, js/ui/rooms.js) or 'pick' (the hero select: the lobby's stage and LOCK IN)
  synced: false,             // a client's: has the first full snapshot landed
  inTick: 0,                 // a client's: the tick its last input went out for
  lastTick: -1,              // a client's: the newest snapshot tick applied
  hostOver: null,            // a client's: the host's own `state.over`, kept out of ours
  bytesIn: 0, bytesOut: 0,   // running totals, for the measurements
  bpsIn: 0, bpsOut: 0, bpsT: 0, bIn0: 0, bOut0: 0, // ...and the last second's rate
  uid: null,                 // a client's identity across a reconnect (per tab)
  dictOut: null, dictIn: null, // the key dictionaries the bytes are written and read with (js/net/snapshot.js)
  verify: false,             // a host's: every VERIFY_EVERY ticks the full form rides along and each client checks itself against it
  verifyFail: null,          // a client's: the first fields that disagreed, if any ever did
};
// how often a host sends: every SNAP_EVERY ticks (15 Hz at the 60 Hz step;
// the client interpolates between two, netClientLerp). LATE_JOIN_T: how far
// into a match a new peer may still take an AI slot; RECONNECT_GRACE: how
// long a dropped peer's slot waits for it before the bot keeps it.
const SNAP_EVERY = 4;
const VERIFY_EVERY = 300;
const LERP_SNAP = 120; // px: a body that moved further than this between snapshots teleported, and is not eased
const LATE_JOIN_T = 300;
const RECONNECT_GRACE = 60;
const IN_QMAX = 4;  // a peer's inputs a host holds in line (netHostStep): past this, 66 ms of them, the oldest fold together
const IN_QWIN = 30; // steps: a line that never fell under two in this long is standing, and gives one back
// which controls are a person: a `remote` body is a human on another screen,
// and everything that treats a human differently from a bot (a whole side
// reading its flag, the pack auto-fitting, the eagle never force-dropping it)
// asks this rather than the string
function isHuman(p) { return p.control === 'human' || p.control === 'remote'; }
// is this match shared with another screen: then nobody can pause it - the
// host's settings and pause keep the step running for its peers, and a
// client never stepped anything to pause
function netShared() { return NET.isClient || NET.peers.size > 0; }

// The transport interface every adapter implements - the loopback here, the
// WebSocket relay for tabs on one machine (js/net/transport-ws.js), Steam's
// networking sockets from the wrapper later:
//   connect(room)              client: open a session to the host
//   listen()                   host: accept sessions
//   send(peer, msg, lossy) -> bool  a host names the peer (or '*'), a client's go to the host;
//                              lossy marks bytes a transport may drop whole (a delta, never a full sync)
//   poll(dt) -> [{ peer, msg }]
//   close()
// The loopback has no peers: send drops, poll is empty. It exists so that the
// host code path runs unchanged in solo, with nothing to receive.
const loopbackTransport = {
  connect() {}, listen() {}, send() { return false; }, poll() { return []; }, close() {},
};

function netSetup(role, transport) {
  if (NET.transport && NET.transport !== loopbackTransport) NET.transport.close();
  NET.role = role || 'solo';
  NET.transport = transport || loopbackTransport;
  NET.peers.clear(); NET.parked.clear(); NET.kicked.clear(); NET.ready.clear(); NET.pings = []; NET.pingT = 0; NET.chat = []; NET.ranks = []; NET.botLv = null; NET.code = '';
  NET.easeAt = 0; NET.gapAvg = 0; NET.gapDev = 0; NET.easeMs = 0;
  NET.synced = false; NET.welcomed = false; NET.helloed = false; NET.refused = null; NET.lastTick = -1; NET.hostOver = null; NET.countN = -1; NET.published = false; NET.phase = 'room'; NET.rematch = null; NET.nextSeed = 0; NET.was = null;
  NET.dictOut = encDict(); NET.dictIn = encDict(); NET.verifyFail = null;
  NET.bytesIn = 0; NET.bytesOut = 0; NET.bIn0 = 0; NET.bOut0 = 0; NET.bpsT = 0; NET.dropped = 0; NET.fulls = 0;
  if (NET.role === 'host') { NET.transport.listen(); snapShadowReset(); }
  if (NET.role === 'client') {
    try { NET.uid = sessionStorage.getItem('softfall.netuid'); } catch (e) {}
    if (!NET.uid) { NET.uid = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('softfall.netuid', NET.uid); } catch (e) {} }
    NET.transport.connect();
  }
}
// Which relay this screen talks to (host:port). ?relay=ADDR in the URL sets
// it for good (it is remembered with the settings, the way the wrapper's
// --relay flag arrives as that query); otherwise the address the page was
// served from, which is the relay itself when Noah serves the game; a page
// off the disk with nothing remembered assumes the relay is on this machine.
const RELAY_DEFAULT = 'localhost:8471';
function netRelay() {
  const q = /[?&]relay=([^&]+)/.exec(location.search);
  if (q) { const r = decodeURIComponent(q[1]); if (settings.relay !== r) { settings.relay = r; saveSettings(); } return r; }
  if (settings.relay) return settings.relay;
  if (location.protocol === 'http:' || location.protocol === 'https:') return location.host;
  return RELAY_DEFAULT;
}
// The three doors the party lobby opens (js/ui/rooms.js): host a room on
// the relay (every party is one), join one by its code, or leave whichever
// this is and be solo again with today's ten. The Steam transport takes the
// same three when the wrapper is asked for it (?transport=steam).
// is this screen riding Steam: the wrapper's bridge is there and the page
// was asked for it (?transport=steam, the wrapper's --transport=steam). A
// code is looked up on Steam's lobbies then instead of the relay's rooms
function netSteam() { return !!window.steamBridge && /[?&]transport=steam/.test(location.search); }
function netTransportFor(room) {
  if (netSteam()) return steamTransport(room);
  return wsTransport(netRelay(), room);
}
function netHost() { netSetup('host', netTransportFor(null)); }
function netJoin(code) { netSetup('client', netTransportFor(code)); }
function netLeave() {
  const was = NET.role;
  netSetup('solo');
  if (was === 'client') { initPlayers(); camX = player.x - WV_W / 2; camY = player.y - WV_H / 2; } // the host's roster goes with the host
  else if (was === 'host') for (const p of players) if (p.control === 'remote') { p.control = 'ai'; p.input = makeInput(); }
}
// what the relay's list says of this room: who hosts it, on what patch, seed
// and map shape, whether it is still open, and how many people are in it -
// what a code typed into another party's box is matched against
function netHostRoom() {
  if (NET.role !== 'host' || !NET.transport.roomData) return;
  let humans = 0; const sides = [0, 0];
  for (const p of players) if (isHuman(p)) { humans++; sides[p.team]++; }
  NET.transport.roomData({ name: player ? player.name : '', patch: PATCH_TXT, seed: SEED, map: MAP_TYPE, state: state.drop ? 'live' : 'open', humans, sides });
}
// the roster to every peer, on every change of it: a client's waiting room
// draws the same ten this one does
function netHostRoster() { if (NET.role === 'host' && NET.peers.size) NET.transport.send('*', Object.assign({ t: 'roster', roster: netRoster() }, roomInfo())); }

// ------------------------------------------------------------ host
// Runs at the top of the step: the peers' messages become their bodies'
// input structs, a HELLO becomes a slot, a vanished peer becomes a bot.
// A remote input is MERGED, not copied: held fields overwrite, edge fields
// (dodge, a meal, an ability, an order) latch until the sim consumes them,
// since a press between two steps must not be lost to the next struct.
function netHostStep(dt) {
  if (NET.role !== 'host') return;
  for (const { peer, msg } of NET.transport.poll(dt)) {
    if (msg.t === 'peer') continue;                         // the relay's notice; HELLO follows
    if (msg.t === 'gone') { netHostLeave(peer); continue; }
    if (msg.t === 'hello') { netHostHello(peer, msg); continue; }
    const pr = NET.peers.get(peer);
    if (!pr) continue;
    if (msg.t === 'resync') { netHostFull(peer, pr); continue; } // a delta the client could not take: the whole thing again
    if (msg.t === 'ready') { seatReady(pr.slot, !!msg.on); continue; }    // the party: a guest's READY
    if (msg.t === 'pick') { seatPick(pr.slot, msg.cls | 0); continue; }   // ...a guest's hero, on the hero select
    if (msg.t === 'say') { talkFrom(pr, msg.s); continue; }               // ...a line for the room's chat
    if (msg.t === 'pong') { pongIn(pr, msg); continue; }                   // ...and its answer to a ping
    if (msg.t === 'in') {
      NET.bytesIn += JSON.stringify(msg).length;
      if (msg.ack > pr.ack) pr.ack = msg.ack; // the newest snapshot it applied: its next delta is cut from there
      pr.q.push(msg);
    }
  }
  // ONE queued input per peer per step, the way the client stepped them: two
  // that arrive together are two steps, not one, so the walk a client ran
  // ahead (netPredict) is the walk the host runs. An empty queue holds the
  // last input. A queue never stands: past IN_QMAX (a stall, a burst), or
  // never below two for a whole IN_QWIN of steps, its oldest folds into the
  // next, edges kept - one step of walk lost, against a delay on every action
  for (const pr of NET.peers.values()) {
    pr.qMin = Math.min(pr.qMin, pr.q.length);
    if (++pr.qN >= IN_QWIN) { if (pr.qMin >= 2) netInEdges(pr.q[1].in, pr.q.shift().in); pr.qN = 0; pr.qMin = Infinity; }
    while (pr.q.length > IN_QMAX) netInEdges(pr.q[1].in, pr.q.shift().in);
    const msg = pr.q.shift();
    if (!msg) continue;
    const i = players[pr.slot].input, m = msg.in;
    i.mx = m.mx; i.my = m.my; i.aimX = m.aimX; i.aimY = m.aimY;
    i.fire = m.fire; i.work = m.work; i.slide = m.slide; i.grapple = m.grapple;
    netInEdges(i, m);
    pr.lastTick = msg.tick;
  }
  for (const [uid, park] of NET.parked) { park.t += dt; if (park.t > RECONNECT_GRACE) NET.parked.delete(uid); }
  // the waiting room's count, to every peer as it changes: the digits a
  // client shows are the host's, and so is the moment the eagle comes
  if (NET.transport.open && !NET.published) { NET.published = true; netHostRoom(); }
  pingsHost(dt);
  rematchOffer(); // a match that has ended names the next valley to every guest (js/ui/rooms.js)
  if (state.mode === 'title' && NET.peers.size) {
    const m = state.menu, n = m.countT > 0 ? Math.ceil(m.countT) : m.countN === 0 ? 0 : -1;
    if (n !== NET.countN) { NET.countN = n; NET.transport.send('*', { t: 'count', ct: m.countT, n }); }
  }
}
// a press in `m` latched into `i` until the sim consumes it
function netInEdges(i, m) {
  i.dodge = i.dodge || m.dodge; i.jump = i.jump || m.jump; i.eatBerry = i.eatBerry || m.eatBerry; i.eatFish = i.eatFish || m.eatFish; i.useCard = i.useCard || m.useCard;
  if (m.ability >= 0) i.ability = m.ability;
  if (m.cmd) i.cmd = m.cmd;
}
function netHostHello(peer, msg) {
  const refuse = (why) => NET.transport.send(peer, { t: 'refuse', why });
  if (NET.kicked.has(msg.uid)) return refuse('KICKED');
  if (msg.patch !== PATCH_TXT) return refuse('VERSION');
  if (msg.seed !== SEED) return refuse('SEED');
  if ((msg.map | 0) !== MAP_TYPE) return refuse('SEED'); // the same world means the same shape of it (MAPS, world.js)
  let slot = -1;
  const park = NET.parked.get(msg.uid) || rematchSeat(msg.uid); // a dropped peer's slot, or the one it held last match
  if (park && !isHuman(players[park.slot])) { slot = park.slot; NET.parked.delete(msg.uid); }
  else if (NET.mode) {
    // a party: a seat on the leader's own side, while it is still choosing
    // whom to bring - never once the hero select or the match has begun
    if (state.mode !== 'title' || NET.phase !== 'room') return refuse('BUSY');
    const seat = players.find((p) => p.team === player.team && !isHuman(p));
    if (!seat) return refuse('FULL');
    slot = seat.id;
  } else {
    if (state.drop && state.elapsed > LATE_JOIN_T) return refuse('LATE');
    // the smaller side's first open seat (the side with fewer people, not
    // fewer bodies): on a side short of the room's size (its fullest side's
    // seats, TEAMS) an empty one before a bot's, so a room the host thinned
    // to people only fills before a bot is bumped; on a full side a bot's,
    // so TEAMS holds. A match under way has only bots' bodies to take over -
    // an empty seat never landed
    const humans = [0, 0], filled = [0, 0];
    for (const p of players) { if (isHuman(p)) humans[p.team]++; if (p.active) filled[p.team]++; }
    const want = humans[0] <= humans[1] ? 0 : 1, size = Math.max(filled[0], filled[1]);
    for (const t of [want, 1 - want]) { const kinds = state.drop ? ['ai'] : filled[t] >= size ? ['ai', 'none'] : ['none', 'ai']; for (const k of kinds) { for (const p of players) if (p.control === k && p.team === t) { slot = p.id; break; } if (slot >= 0) break; } if (slot >= 0) break; }
    if (slot < 0) return refuse('FULL');
  }
  const p = players[slot];
  p.control = 'remote';
  if (msg.name) p.name = msg.name;
  if (msg.look) p.look = msg.look;
  if (msg.cls !== undefined && msg.cls !== null) setClass(p, msg.cls);
  NET.ranks[slot] = msg.rank | 0 || null;
  const pr = { slot, uid: msg.uid, name: msg.name, lastTick: 0, ack: -1, dictAt: new Map(), q: [], qMin: Infinity, qN: 0 };
  NET.peers.set(peer, pr);
  NET.transport.send(peer, Object.assign({ t: 'welcome', slot, hostSlot: localId, seed: SEED, tick: state.tick, roster: netRoster(), phase: NET.phase }, roomInfo()));
  netHostFull(peer, pr);
  logEvent((p.name || 'A PLAYER') + ' JOINED', p);
  roomAttention(); // a host tabbed out hears the room fill (js/ui/roomtalk.js)
  netHostRoster(); netHostRoom();
}
// the whole match to one peer, and that peer's base set to this tick: the
// full sync rides the reliable channel, so the host takes it as held from
// the moment it goes (an ack that never comes only makes later deltas fatter
// until the ring runs out, and then it is this again). The bytes carry the
// dictionary from index 0, whole
function netHostFull(peer, pr) {
  const h = snapHistoryPush();
  const full = snapEncode({ t: 'full', tick: h.tick, snap: snapBuild(), ia: pr.lastTick }, NET.dictOut, 0);
  NET.bytesOut += NET.transport.send(peer, full) ? full.length : 0;
  NET.fulls++;
  pr.ack = h.tick;
  pr.dictAt = new Map([[h.tick, NET.dictOut.names.length]]);
}
function netHostLeave(peer) {
  const pr = NET.peers.get(peer);
  if (!pr) return;
  NET.peers.delete(peer);
  const p = players[pr.slot];
  p.control = 'ai'; // the side keeps its number while the slot waits
  p.input = makeInput();
  NET.parked.set(pr.uid, { slot: pr.slot, t: 0 });
  NET.ready.delete(pr.slot); NET.pings[pr.slot] = null; NET.ranks[pr.slot] = null;
  if (NET.mode && state.mode === 'title' && NET.phase === 'room') p.control = 'none'; // a party's seat stands empty again for the next friend
  logEvent((p.name || 'A PLAYER') + ' LEFT', p);
  netHostRoster(); netHostRoom();
}
// ------------------------------------------------------------ seats
// The party's moves, every one the host's to make: a friend shown out, a
// guest's hero picked on the hero select, and the page (the party's seats,
// or the pick) turned on every screen. Only before the count: once LOCK IN
// is pressed the sides are what the eagles will carry.
function seatsOpen() { return state.mode === 'title' && !state.drop && !(state.menu.countT > 0) && !(state.menu.lockT > 0); }
// the host turns the party's page (the seats, or the pick) on every screen
// at once; a guest follows it from wherever it stands in the title
function netPhase(ph) {
  if (NET.role !== 'host') return;
  NET.phase = ph;
  if (NET.peers.size) NET.transport.send('*', { t: 'phase', phase: ph });
}
function netClientPhase(ph) {
  NET.phase = ph;
  const s = state.menu.screen;
  if (state.mode !== 'title' || !(s === 'room' || s === 'lobby' || popOpen())) return;
  if (popOpen()) leavePop();
  if (ph === 'pick') beginLobby(); else beginRoom();
}
// the leader's hand on a friend: shown out of the party (and kept out of it
// - the kick list lives as long as the room), the seat empty again
function seatKick(slot) {
  if (NET.role !== 'host' || !seatsOpen()) return;
  for (const [peer, pr] of NET.peers) if (pr.slot === slot) {
    NET.transport.send(peer, { t: 'refuse', why: 'KICKED' });
    NET.peers.delete(peer);
    NET.kicked.add(pr.uid);
    NET.ready.delete(slot); NET.pings[slot] = null; NET.ranks[slot] = null;
    const p = players[slot];
    p.control = NET.mode ? 'none' : 'ai'; p.input = makeInput(); p.name = null;
    logEvent((pr.name || 'A PLAYER') + ' LEFT', p);
    netHostRoster(); netHostRoom();
    return;
  }
}
// a hero picked on the hero select: the host sets its own, a guest asks the
// host (`pick`), and every screen sees it with the next roster
function seatPick(slot, cls) {
  const p = players[slot];
  if (NET.role === 'client' || !p || !seatsOpen() || !CLASSES[cls]) return;
  setClass(p, cls);
  netHostRoster();
}
function netPick(cls) {
  if (NET.isClient) NET.transport.send('host', { t: 'pick', cls });
  else seatPick(localId, cls);
}
// ------------------------------------------------------------ room info
// What the party shows beyond the seats, the host's to keep and sent with
// every roster (and the welcome): who has said READY, the bots' level, the
// mode, the party's code and each person's RANKED rating. READY is a
// person's word that they are at the keys; the leader's FIND MATCH waits on
// every person's (roomAllReady, js/ui/rooms.js). The pings
// go round every PING_EVERY: the host stamps a `ping` to each peer, the
// peer sends the stamp straight back, and the round trip (eased) goes out
// to everyone as `pings`, a number per slot, so every screen can draw each
// person's link - over the relay this is the whole path, two hops.
const PING_EVERY = 2;   // s between rounds
const PING_EASE = 0.5;  // the new round's share of a peer's eased round trip
function roomInfo() {
  if (NET.isHost) NET.ranks[localId] = PROFILE.rank();
  return { ready: [...NET.ready], lvl: roomLevel(), mode: NET.mode, code: roomCode(), ranks: NET.ranks };
}
// a guest's copy, off a roster or the welcome
function roomInfoIn(msg) {
  if (msg.ready) NET.ready = new Set(msg.ready);
  if (msg.lvl !== undefined) NET.aiLevel = msg.lvl | 0;
  if (msg.mode !== undefined) NET.mode = msg.mode;
  if (msg.code) NET.code = String(msg.code);
  if (Array.isArray(msg.ranks)) NET.ranks = msg.ranks;
}
function seatReady(slot, on) {
  if (NET.role !== 'host' || !seatsOpen()) return;
  if (on) NET.ready.add(slot); else NET.ready.delete(slot);
  netHostRoster();
}
// this screen's own READY: a guest asks the host, who keeps the list
function netReady(on) {
  if (NET.isClient) NET.transport.send('host', { t: 'ready', on });
}
function pingsHost(dt) {
  if (!NET.peers.size || (NET.pingT += dt) < PING_EVERY) return;
  NET.pingT = 0;
  const now = performance.now(), ms = players.map(() => null);
  for (const [peer, pr] of NET.peers) {
    NET.transport.send(peer, { t: 'ping', at: now });
    if (pr.rtt !== undefined) ms[pr.slot] = Math.round(pr.rtt);
  }
  NET.pings = ms;
  NET.transport.send('*', { t: 'pings', ms });
}
function pongIn(pr, msg) {
  const rtt = performance.now() - (+msg.at || 0);
  if (!(rtt >= 0 && rtt < 60000)) return;
  pr.rtt = pr.rtt === undefined ? rtt : pr.rtt + (rtt - pr.rtt) * PING_EASE;
}
function netRoster() { return players.map((p) => ({ control: p.control, team: p.team, name: p._name, cls: p.cls, look: p.look })); }
// after the step: every SNAP_EVERY ticks this tick goes into the ring and
// each peer gets the delta from ITS acked tick (peers on one ack share the
// cut), with the cosmetics the step recorded; a peer whose ack has aged out
// of the ring gets the whole match again. The dictionary header starts where
// that peer's acked message left the list (js/net/snapshot.js, `encode`)
function netHostFlush() {
  if (NET.role !== 'host') return;
  evRecord = NET.peers.size > 0;
  if (!NET.peers.size) { evRing.length = 0; return; }
  // the steps between two flushes each scan their share of the tiles, so the
  // flush step does not carry the whole world alone (snapTileScan)
  if (state.tick % SNAP_EVERY) { snapTileScan(Math.ceil(objects.length * (state.tick % SNAP_EVERY) / SNAP_EVERY)); return; }
  const check = NET.verify && state.tick % VERIFY_EVERY === 0;
  if (check) snapShadow.scanAt = 0; // the proof's tick sees every tile now, not a slice ago
  const h = snapHistoryPush();
  const ev = evDrain();
  const full = check ? snapBuild() : null; // the client checks itself against this
  const cuts = new Map(); // ack tick -> delta
  for (const [peer, pr] of NET.peers) {
    const base = snapHistoryAt(pr.ack);
    if (!base) { netHostFull(peer, pr); continue; }
    let d = cuts.get(pr.ack);
    if (!d) { d = snapDeltaFrom(h, base); cuts.set(pr.ack, d); }
    const msg = { t: 'snap', tick: h.tick, d, ev, ia: pr.lastTick }; // ia: the newest of this peer's inputs the step has taken (netPredict)
    if (full) msg.full = full;
    const bytes = snapEncode(msg, NET.dictOut, pr.dictAt.get(pr.ack) || 0);
    pr.dictAt.set(h.tick, NET.dictOut.names.length);
    for (const t of pr.dictAt.keys()) if (t < pr.ack) pr.dictAt.delete(t);
    if (NET.lossOut && Math.random() < NET.lossOut) { NET.dropped++; continue; } // the proof's lossy wire
    NET.bytesOut += bytes.length;
    NET.transport.send(peer, bytes, true); // lossy: the ring resends what a dropped delta carried
  }
  netRate();
}
// the last second's bytes each way, for netStatus
function netRate() {
  const now = performance.now();
  if (now - NET.bpsT < 1000) return;
  const dt = (now - NET.bpsT) / 1000;
  NET.bpsIn = Math.round((NET.bytesIn - NET.bIn0) / dt); NET.bpsOut = Math.round((NET.bytesOut - NET.bOut0) / dt);
  NET.bIn0 = NET.bytesIn; NET.bOut0 = NET.bytesOut; NET.bpsT = now;
}

// ------------------------------------------------------------ client
// A client's step: its own input goes out, whatever arrived comes in. The
// sim never runs here; the snapshot IS the match, and the only thing decided
// locally is which screen to show for it (netClientMode).
function netClientStep(dt) {
  if (NET.role !== 'client') return;
  const T = NET.transport;
  if (NET.synced && player) {
    const i = player.input;
    const msg = { t: 'in', tick: ++NET.inTick, ack: NET.lastTick, in: { mx: i.mx, my: i.my, aimX: i.aimX, aimY: i.aimY, fire: i.fire, work: i.work, slide: i.slide, grapple: i.grapple, dodge: i.dodge, jump: i.jump, eatBerry: i.eatBerry, eatFish: i.eatFish, useCard: i.useCard, ability: i.ability, cmd: i.cmd } };
    if (T.send('host', msg)) NET.bytesOut += JSON.stringify(msg).length;
    netPredictStep(msg.tick, i, dt); // our own walk goes ahead of the host's word
    // the edges are the host's now: a press is sent once
    i.dodge = false; i.jump = false; i.eatBerry = false; i.eatFish = false; i.useCard = false; i.ability = -1; i.cmd = null;
  }
  netClientLerp();
  netClientStats();
  netRate();
  for (const item of T.poll(dt)) {
    // once the host has left for a rematch this socket's room belongs to its
    // NEXT page: its roster, count and snapshots are for a match this page is not in
    if (NET.rematch && NET.rematch.gone) continue;
    let msg = item.msg;
    // bytes: a full snapshot or a delta, read with the dictionary the welcome seeded
    if (item.bin) {
      NET.bytesIn += item.bin.length;
      try { msg = snapDecode(item.bin, NET.dictIn); } catch (e) { NET.refused = 'BYTES'; continue; }
      if (msg.t === 'full') { netPredictRestore(); netClientApply(msg.snap); NET.synced = true; NET.lastTick = msg.tick; netPredictMend(msg.ia, null, true); continue; }
      if (msg.t === 'snap') { if (NET.synced) netClientApplyDelta(msg); continue; }
      continue;
    }
    if (msg.t === 'closed') { NET.synced = false; continue; }    // the transport redials; HELLO again on open
    if (msg.t === 'refuse') { NET.refused = msg.why; continue; }
    if (msg.t === 'hostGone') { // the match ends here: a plate in play, the rooms list from the waiting room (updateTitle)
      NET.refused = 'HOSTGONE'; NET.synced = false;
      if (NET.rematch) NET.rematch.gone = true;
      // ...unless the match already ended (a result stays the result) or the
      // host only went to reopen the room for a rematch (rematchHeard, js/ui/rooms.js)
      if (state.mode !== 'title' && !NET.rematch && !(state.over === 'won' || state.over === 'lost')) endMatch('hostleft');
      continue;
    }
    if (msg.t === 'rematch') { rematchHeard(msg); continue; }
    if (msg.t === 'welcome') { netClientWelcome(msg); continue; }
    // the waiting room: the host's ten and its count, drawn here as there
    if (msg.t === 'roster') { netClientRoster(msg.roster); roomInfoIn(msg); continue; }
    if (msg.t === 'ping') { T.send('host', { t: 'pong', at: msg.at }); continue; } // straight back: the host times the trip
    if (msg.t === 'pings') { NET.pings = msg.ms || []; continue; }
    if (msg.t === 'said') { talkAdd(msg.slot | 0, talkClean(msg.s)); continue; } // the room's chat, as the host passed it on
    if (msg.t === 'count') { state.menu.countT = msg.ct; state.menu.countN = msg.n; continue; }
    if (msg.t === 'phase') { netClientPhase(msg.phase); continue; }
  }
  if (T.open && !NET.helloed) { netClientHello(); NET.helloed = true; }
  if (!T.open) NET.helloed = false;
}
// The character's lifetime stats on a client. Every PROFILE.add* in the sim
// is gated on `p === player` INSIDE the step, which only the host's screen
// runs, so a client reads the same facts off its own body as the snapshots
// move it: xp is the match's gold earned (gainGold), kills only climbs, a
// death is dead's rising edge, the match and its first day start at takeoff
// (beginDrop's two, which a client never calls) and the leap off the bird is
// aboard's falling edge (dropJump's markDropped, and off a FLYING bird the
// hard music cut - the leap's cue itself arrives as sfxFor's event). A redial
// keeps the baseline, so what was earned while the socket was down still counts.
function netClientStats() {
  const me = player;
  if (!NET.synced || !me || state.mode === 'title') return;
  const w = NET.was;
  if (!w || w.p !== me) { PROFILE.addMatch(); PROFILE.addDay(); }
  else {
    if (me.xp > w.xp) PROFILE.addGold(me.xp - w.xp);
    for (let k = w.kills; k < me.kills; k++) PROFILE.addKill();
    if (me.dead && !w.dead) PROFILE.addDeath();
    if (w.aboard && !me.aboard) {
      PROFILE.markDropped();
      const e = state.drop && state.drop.eagles[me.team];
      if (e && e.state !== 'down') SFX.music.play('jump', { out: 0.1, in: 0.05 });
    }
  }
  NET.was = { p: me, xp: me.xp, kills: me.kills, dead: me.dead, aboard: me.aboard };
}
function netClientHello() {
  const c = PROFILE.char();
  NET.transport.send('host', { t: 'hello', uid: NET.uid, patch: PATCH_TXT, seed: SEED, map: MAP_TYPE, name: c ? c.name : PROFILE.name(), cls: c ? c.cls : 0, look: c ? c.look : null, rank: PROFILE.rank() });
}
// the roster the host dealt: our slot is the human here, the host's is a
// remote one, and the bodies are built before the first snapshot fills them
function netClientWelcome(msg) {
  const roster = msg.roster.map((r, i) => ({ control: i === msg.slot ? 'human' : r.control === 'human' ? 'remote' : r.control, team: r.team, name: r.name, cls: r.cls, look: r.look }));
  NET.hostSlot = msg.hostSlot;
  NET.phase = msg.phase || 'room';
  initPlayers(roster, msg.slot);
  roomInfoIn(msg);
  camX = player.x - WV_W / 2; camY = player.y - WV_H / 2;
  NET.dictIn = encDict(); // the full sync that follows carries the host's whole list
  PRED.hist.length = 0; PRED.on = false;
  NET.welcomed = true; // the title screen moves to the waiting room on this
}
// a later roster (someone came or went while we wait): the bodies stay, their
// names, classes, faces and kinds change in place - ours stays the human
function netClientRoster(roster) {
  for (let i = 0; i < players.length && i < roster.length; i++) {
    const p = players[i], r = roster[i];
    p.team = r.team; // the host deals the sides, ours included
    if (i === localId) continue;
    p.control = r.control === 'human' ? 'remote' : r.control;
    p.team = r.team;
    p.name = r.name;
    if (r.look) p.look = r.look;
    if (p.cls !== r.cls) setClass(p, r.cls);
  }
}
// the snapshot in, with the host's own result kept out of ours: `over` is a
// screen's verdict, not the match's, and the client reads its own off the bird
function netClientApply(s) {
  const over = state.over, end = state.end;
  snapApply(s);
  NET.hostOver = state.over;
  state.over = over; state.end = end;
  // a control is a screen's own view: the host's human is a remote body here
  // and ours is the human, whatever the host calls them
  for (const p of players) { if (p.id === localId) p.control = 'human'; else if (p.control === 'human') p.control = 'remote'; }
  netClientMode();
}
// a delta in: the entities it names change in place, the host's verdict and
// our controls are kept as in a full apply, the events it carried play, and
// every moving body it touched is set up to EASE from where it is drawn to
// where the host put it over the next snapshot interval (netClientLerp)
function netClientApplyDelta(msg) {
  // an unreliable channel can hand us yesterday: a snapshot no newer than the
  // one held is nothing; a delta cut from a base newer than what is held (the
  // host thought we had something we never got) cannot be taken at all
  if (msg.tick <= NET.lastTick) return;
  if (msg.d.base > NET.lastTick) { NET.synced = false; NET.transport.send('host', { t: 'resync' }); return; }
  const over = state.over, end = state.end;
  // the display positions, before the host's overwrite them
  const shown = new Map();
  for (const k in SNAP_KINDS) for (const e of SNAP_KINDS[k]()) shown.set(e, [e.x, e.y]);
  for (const p of players) shown.set(p, [p.x, p.y]);
  if (state.drop) for (const e of state.drop.eagles) shown.set(e, [e.x, e.y]);
  shown.set(orca, [orca.x, orca.y]);
  const ahead = netPredictRestore(); // our body back to the host's last word before its next one lands
  const changed = snapApplyDelta(msg.d);
  if (changed && msg.d.orca) changed.push([orca, msg.d.orca]); // the orca is a singleton, eased like a body
  NET.lastTick = msg.tick;
  if (changed === null) { NET.synced = false; NET.transport.send('host', { t: 'resync' }); return; } // an id we never had: ask for the whole thing
  // the check, against the host's own full form when it rides along
  if (msg.full && !NET.verifyFail) {
    // a body still easing toward an earlier target is compared at that
    // target, not where it is drawn - PER AXIS: an axis this delta moved
    // already holds the host's value, the other is still drawn short of its
    // own target (a fish that turned in x alone is still easing in y)
    const movedX = new Set(), movedY = new Set();
    for (const [e, f] of changed) { if ('x' in f) movedX.add(e); if ('y' in f) movedY.add(e); }
    const eased = [];
    for (const [e] of shown) if (e._t0) { eased.push([e, e.x, e.y]); if (!movedX.has(e)) e.x = e._tx; if (!movedY.has(e)) e.y = e._ty; }
    const out = []; snapCompareLoose(msg.full, snapBuild(), '', out, 8);
    for (const [e, x, y] of eased) { e.x = x; e.y = y; }
    if (out.length) NET.verifyFail = { tick: msg.tick, out };
  }
  NET.hostOver = state.over;
  state.over = over; state.end = end;
  for (const p of players) { if (p.id === localId) p.control = 'human'; else if (p.control === 'human') p.control = 'remote'; }
  for (const ev of msg.ev || []) evPlay(ev);
  const now = performance.now();
  for (const [e, f] of changed) {
    if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
    const mx = 'x' in f, my = 'y' in f;
    if (!mx && !my) continue; // the body did not move: whatever ease it is on goes on
    const was = shown.get(e);
    // the host's position: the field that came, or the target already held for the one that did not
    const hx = mx ? e.x : e._t0 ? e._tx : e.x, hy = my ? e.y : e._t0 ? e._ty : e.y;
    if (!was || Math.hypot(hx - was[0], hy - was[1]) > LERP_SNAP) { e.x = hx; e.y = hy; e._tx = hx; e._ty = hy; e._t0 = 0; continue; } // new here, or teleported: no easing
    e._fx = was[0]; e._fy = was[1]; e._tx = hx; e._ty = hy; e._t0 = now;
    e.x = was[0]; e.y = was[1];
  }
  netPredictMend(msg.ia, ahead);
  netEaseClock(now);
  netClientMode();
}
// how long an ease runs: the time deltas take to arrive, plus room for the
// wobble in it, so a late one finds every body still easing toward the last
// word instead of stood at it - a stop-start walk is what a wobbly connection
// otherwise looks like. One snapshot interval on a steady wire, up to EASE_MAX
const EASE_MAX = 160; // ms
function netEaseClock(now) {
  const dt = NET.easeAt ? now - NET.easeAt : 0;
  NET.easeAt = now;
  if (dt <= 0 || dt > 1000) return; // the first, or after a stall: nothing to learn from
  const base = SNAP_EVERY * TICK_DT * 1000;
  NET.gapAvg = NET.gapAvg ? NET.gapAvg + (dt - NET.gapAvg) * 0.1 : base;
  NET.gapDev = (NET.gapDev || 0) + (Math.abs(dt - NET.gapAvg) - (NET.gapDev || 0)) * 0.1;
  NET.easeMs = Math.max(base, Math.min(EASE_MAX, NET.gapAvg + 2 * NET.gapDev));
}
// every tick: each eased body moves from where it was drawn toward the
// host's position over about one snapshot interval (netEaseClock), so 15 snapshots a second read
// as motion rather than steps. A body the host stopped naming keeps its last
// target; the local player is eased like the rest whenever it is not walking
// ahead of the host (netPredict, below)
function netClientLerp() {
  const now = performance.now(), period = NET.easeMs || SNAP_EVERY * TICK_DT * 1000;
  const ease = (e) => {
    if (e._t0 === undefined || e._t0 === 0) return;
    const k = Math.min(1, (now - e._t0) / period);
    e.x = e._fx + (e._tx - e._fx) * k; e.y = e._fy + (e._ty - e._fy) * k;
    if (k >= 1) e._t0 = 0;
  };
  for (const k in SNAP_KINDS) for (const e of SNAP_KINDS[k]()) ease(e);
  for (const p of players) if (!(PRED.on && p === player)) ease(p);
  if (state.drop) for (const e of state.drop.eagles) ease(e);
  ease(orca);
}
// which screen this state calls for, from the local player's own body: the
// ride while aboard or falling, the death overlay while down, play otherwise,
// and the match's end read from the host's verdict turned to our side
function netClientMode() {
  const me = player;
  if (!me || !state.drop) return;
  const hostWon = NET.hostOver === 'won' ? true : NET.hostOver === 'lost' ? false : null;
  if (state.over === 'hostleft') return;
  if (hostWon !== null && state.over !== 'won' && state.over !== 'lost') {
    const hostTeam = players[NET.hostSlot].team;
    endMatch((hostWon ? hostTeam : 1 - hostTeam) === me.team ? 'won' : 'lost');
    return;
  }
  if (state.over === 'won' || state.over === 'lost') return;
  if (me.aboard || me.dropT > 0) {
    if (state.mode !== 'drop') { state.mode = 'drop'; state.menu.panel = null; state.menu.screen = 'menu'; applyZoom(0, true); }
    return;
  }
  if (me.dead) {
    if (state.mode !== 'dead') endMatch(me.eliminated ? 'lost' : 'respawning');
    return;
  }
  if (state.mode === 'drop') { handOver(me); return; }
  if (state.mode === 'dead') { state.over = null; state.mode = 'play'; state.spec = -1; state.introFrom = { x: camX, y: camY }; state.intro = HUD_IN_T; state.introLen = HUD_IN_T; return; }
  if (state.mode === 'title') { state.mode = 'play'; state.menu.panel = null; state.menu.screen = 'menu'; }
}

// ------------------------------------------------------------ prediction
// A client's own walk runs AHEAD of the host instead of a round trip behind
// it: each step the input that went out is also stepped here, through the
// same walk the host runs (walkHeading/walkSlide/walkStep, js/sim/sim.js), on the
// local body alone. Each snapshot names the newest of our inputs the host had
// taken (`ia`); the body goes back to the host's word (netPredictRestore),
// takes the snapshot, and the inputs the host has not yet seen are walked
// again on top of it (netPredictMend). What the replay lands short of or past
// where we were drawn is not snapped: it is carried as an offset the next
// steps bleed off, so a correction reads as a nudge.
// Only the walk is predicted: anything else that owns a body's motion (a
// roll, a rush, the rope, a leap, the cable, the water, a stun, a ride, the
// drop) or any harm is the host's alone, and while one of those holds the
// body is eased like every other (netClientLerp).
const PRED_FIELDS = ['x', 'y', 'vx', 'vy', 'kbx', 'kby', 'sliding', 'slideT', 'moving', 'lastMx', 'lastMy', 'dir'];
const PRED_KEEP = 120;   // inputs remembered: 2 s of steps. A replay that would reach past them is not tried
const PRED_EASE = 0.1;   // s: the time constant a correction bleeds off over
const PRED_SNAP = 48;    // px: a correction this big is a teleport, not a nudge - taken at once
const PRED = { on: false, hist: [], srv: null, ox: 0, oy: 0 };
// may this body walk ahead of the host: on its feet, in play, nothing else
// moving it. Read off the host's word, never off the prediction
function netPredictable(p) {
  return state.mode === 'play' && !p.dead && !inAir(p) && !p.mount && !p.zipWalk && p.zip < 0 &&
    p.stunT <= 0 && p.fallT <= 0 && p.dodgeT <= 0 && p.rushT <= 0 && p.grapT <= 0 && p.leapT <= 0;
}
// one step of the walk, as updatePlayer takes it, on our own body
function netPredictWalk(p, inp, dt) {
  wadeEase(p, dt);
  const hd = walkHeading(p, inp.mx, inp.my, false);
  kbDecay(p, dt);
  const onIce = iceUnder(p), kit = kitOf(p);
  walkSlide(p, inp.slide, dt, onIce, kit);
  walkStep(p, dt, hd.mx, hd.my, hd.len, onIce, kit);
  clampWorld(p);
  if (p.charging) faceToward(p, inp.aimX - p.x, inp.aimY - p.y); // a drawn bow keeps facing the aim, as the step has it
}
// the step's input in (its tick is what `ia` will name), and the body moved
// on by it - with a share of any correction bled off first
function netPredictStep(tick, inp, dt) {
  PRED.hist.push({ t: tick, mx: inp.mx, my: inp.my, slide: inp.slide, aimX: inp.aimX, aimY: inp.aimY });
  if (PRED.hist.length > PRED_KEEP) PRED.hist.shift();
  const p = player;
  if (!PRED.on || !p) return;
  const k = 1 - Math.exp(-dt / PRED_EASE), dx = PRED.ox * k, dy = PRED.oy * k;
  PRED.ox -= dx; PRED.oy -= dy;
  p.x -= dx; p.y -= dy;
  netPredictWalk(p, inp, dt);
}
// before a snapshot lands: the walked-ahead fields back to the host's last
// word, so a delta that does not name one leaves the host's value under it.
// Returns where the body was drawn, for the mend to measure against
function netPredictRestore() {
  const p = player;
  if (!PRED.on || !PRED.srv || !p) return null;
  const at = [p.x, p.y];
  for (const k of PRED_FIELDS) p[k] = PRED.srv[k];
  return at;
}
// after it lands: keep the host's word, and walk the inputs it has not taken
// yet on top of it. `ahead` is where the body was drawn before the restore;
// a delta that moved the body has already set it easing from there (the
// host's word then sits in _tx/_ty), a full sync passes `full` and starts
// from the host's word
function netPredictMend(ia, ahead, full) {
  const p = player;
  if (!p) return;
  if (full) p._t0 = 0;
  const easing = !!p._t0;
  const drawn = easing ? [p.x, p.y] : ahead;
  const hx = easing ? p._tx : p.x, hy = easing ? p._ty : p.y;
  const srv = PRED.srv = PRED.srv || {};
  for (const k of PRED_FIELDS) srv[k] = p[k];
  srv.x = hx; srv.y = hy;
  const h = PRED.hist;
  const ok = netPredictable(p) && typeof ia === 'number' && ia > 0 && h.length > 0 && h[0].t <= ia + 1;
  if (!ok) { // the host's alone: the body eases from where it is drawn to the host's word
    if (PRED.on && drawn && !easing) { p._fx = drawn[0]; p._fy = drawn[1]; p._tx = hx; p._ty = hy; p._t0 = performance.now(); p.x = drawn[0]; p.y = drawn[1]; }
    PRED.on = false; PRED.ox = PRED.oy = 0;
    return;
  }
  p._t0 = 0; p.x = hx; p.y = hy; // ours to move: no ease
  for (const e of h) if (e.t > ia) netPredictWalk(p, e, TICK_DT);
  // what the replay moved the body by against where it was drawn is carried,
  // not snapped - unless it is a teleport
  const ox = drawn ? drawn[0] - p.x : 0, oy = drawn ? drawn[1] - p.y : 0;
  if (Math.hypot(ox, oy) <= PRED_SNAP) { PRED.ox = ox; PRED.oy = oy; p.x += ox; p.y += oy; }
  else PRED.ox = PRED.oy = 0;
  PRED.on = true;
}
