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
  peers: new Map(),          // a host's: transport peer id -> { slot, uid, name, ack, dictAt } - ack: the newest tick that client applied (its delta is cut from there); dictAt: tick -> the dictionary's length after that tick's message to it
  fulls: 0,                  // a host's: how many full syncs it has sent (a join, a resync, an ack aged out of the ring)
  lossOut: 0, dropped: 0,    // a host's proof switch: the fraction of snapshot sends thrown away before the transport (DBG.netLoss), and how many were
  parked: new Map(),         // a host's: uid -> slot, for a peer that dropped and may come back
  hostSlot: 0,               // a client's: which slot the host's own player sits in
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
// which controls are a person: a `remote` body is a human on another screen,
// and everything that treats a human differently from a bot (a whole side
// reading its flag, the pack auto-fitting, the eagle never force-dropping it)
// asks this rather than the string
function isHuman(p) { return p.control === 'human' || p.control === 'remote'; }

// The transport interface every adapter implements - the loopback here, the
// WebSocket relay for tabs on one machine (js/net/transport-ws.js), Steam's
// networking sockets from the wrapper later:
//   connect(room)              client: open a session to the host
//   listen()                   host: accept sessions
//   send(peer, msg) -> bool    a host names the peer (or '*'), a client's go to the host
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
  NET.peers.clear(); NET.parked.clear();
  NET.synced = false; NET.welcomed = false; NET.helloed = false; NET.refused = null; NET.lastTick = -1; NET.hostOver = null; NET.countN = -1; NET.published = false;
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
// The three doors the title screen opens (js/ui/menu.js): host a room on
// the relay, join one by its code, or leave whichever this is and be solo
// again with today's ten. The Steam transport takes the same three when the
// wrapper is asked for it (?transport=steam).
function netTransportFor(room) {
  if (window.steamBridge && /[?&]transport=steam/.test(location.search)) return steamTransport(room);
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
// what the relay's list says of this room: who hosts it, on what patch and
// seed, whether it is still open, and how many people are in it
function netHostRoom() {
  if (NET.role !== 'host' || !NET.transport.roomData) return;
  let humans = 0; const sides = [0, 0];
  for (const p of players) if (isHuman(p)) { humans++; sides[p.team]++; }
  NET.transport.roomData({ name: player ? player.name : '', patch: PATCH_TXT, seed: SEED, state: state.drop ? 'live' : 'open', humans, sides });
}
// the roster to every peer, on every change of it: a client's waiting room
// draws the same ten this one does
function netHostRoster() { if (NET.role === 'host' && NET.peers.size) NET.transport.send('*', { t: 'roster', roster: netRoster() }); }

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
    if (msg.t === 'in') {
      const p = players[pr.slot], i = p.input, m = msg.in;
      NET.bytesIn += JSON.stringify(msg).length;
      if (msg.ack > pr.ack) pr.ack = msg.ack; // the newest snapshot it applied: its next delta is cut from there
      i.mx = m.mx; i.my = m.my; i.aimX = m.aimX; i.aimY = m.aimY;
      i.fire = m.fire; i.work = m.work; i.slide = m.slide; i.grapple = m.grapple;
      i.dodge = i.dodge || m.dodge; i.jump = i.jump || m.jump; i.eatBerry = i.eatBerry || m.eatBerry; i.eatFish = i.eatFish || m.eatFish; i.useCard = i.useCard || m.useCard;
      if (m.ability >= 0) i.ability = m.ability;
      if (m.cmd) i.cmd = m.cmd;
      pr.lastTick = msg.tick;
    }
  }
  for (const [uid, park] of NET.parked) { park.t += dt; if (park.t > RECONNECT_GRACE) NET.parked.delete(uid); }
  // the waiting room's count, to every peer as it changes: the digits a
  // client shows are the host's, and so is the moment the eagle comes
  if (NET.transport.open && !NET.published) { NET.published = true; netHostRoom(); }
  if (state.mode === 'title' && NET.peers.size) {
    const m = state.menu, n = m.countT > 0 ? Math.ceil(m.countT) : m.countN === 0 ? 0 : -1;
    if (n !== NET.countN) { NET.countN = n; NET.transport.send('*', { t: 'count', t: m.countT, n }); }
  }
}
function netHostHello(peer, msg) {
  const refuse = (why) => NET.transport.send(peer, { t: 'refuse', why });
  if (msg.patch !== PATCH_TXT) return refuse('VERSION');
  if (msg.seed !== SEED) return refuse('SEED');
  let slot = -1;
  const park = NET.parked.get(msg.uid);
  if (park && players[park.slot].control === 'ai') { slot = park.slot; NET.parked.delete(msg.uid); }
  else {
    if (state.drop && state.elapsed > LATE_JOIN_T) return refuse('LATE');
    // the smaller side's first AI slot (the side with fewer people, not fewer bodies)
    const humans = [0, 0]; for (const p of players) if (isHuman(p)) humans[p.team]++;
    const want = humans[0] <= humans[1] ? 0 : 1;
    for (const t of [want, 1 - want]) { for (const p of players) if (p.control === 'ai' && p.team === t) { slot = p.id; break; } if (slot >= 0) break; }
    if (slot < 0) return refuse('FULL');
  }
  const p = players[slot];
  p.control = 'remote';
  if (msg.name) p.name = msg.name;
  if (msg.look) p.look = msg.look;
  if (msg.cls !== undefined && msg.cls !== null) setClass(p, msg.cls);
  const pr = { slot, uid: msg.uid, name: msg.name, lastTick: 0, ack: -1, dictAt: new Map() };
  NET.peers.set(peer, pr);
  NET.transport.send(peer, { t: 'welcome', slot, hostSlot: localId, seed: SEED, tick: state.tick, roster: netRoster() });
  netHostFull(peer, pr);
  logEvent((p.name || 'A PLAYER') + ' JOINED', p);
  netHostRoster(); netHostRoom();
}
// the whole match to one peer, and that peer's base set to this tick: the
// full sync rides the reliable channel, so the host takes it as held from
// the moment it goes (an ack that never comes only makes later deltas fatter
// until the ring runs out, and then it is this again). The bytes carry the
// dictionary from index 0, whole
function netHostFull(peer, pr) {
  const h = snapHistoryPush();
  const full = snapEncode({ t: 'full', tick: h.tick, snap: snapBuild() }, NET.dictOut, 0);
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
  logEvent((p.name || 'A PLAYER') + ' LEFT', p);
  netHostRoster(); netHostRoom();
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
  if (state.tick % SNAP_EVERY) return;
  const h = snapHistoryPush();
  const ev = evDrain();
  const full = NET.verify && state.tick % VERIFY_EVERY === 0 ? snapBuild() : null; // the client checks itself against this
  const cuts = new Map(); // ack tick -> delta
  for (const [peer, pr] of NET.peers) {
    const base = snapHistoryAt(pr.ack);
    if (!base) { netHostFull(peer, pr); continue; }
    let d = cuts.get(pr.ack);
    if (!d) { d = snapDeltaFrom(h, base); cuts.set(pr.ack, d); }
    const msg = { t: 'snap', tick: h.tick, d, ev };
    if (full) msg.full = full;
    const bytes = snapEncode(msg, NET.dictOut, pr.dictAt.get(pr.ack) || 0);
    pr.dictAt.set(h.tick, NET.dictOut.names.length);
    for (const t of pr.dictAt.keys()) if (t < pr.ack) pr.dictAt.delete(t);
    if (NET.lossOut && Math.random() < NET.lossOut) { NET.dropped++; continue; } // the proof's lossy wire
    NET.bytesOut += bytes.length;
    NET.transport.send(peer, bytes);
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
    // the edges are the host's now: a press is sent once
    i.dodge = false; i.jump = false; i.eatBerry = false; i.eatFish = false; i.useCard = false; i.ability = -1; i.cmd = null;
  }
  netClientLerp();
  netRate();
  for (const item of T.poll(dt)) {
    let msg = item.msg;
    // bytes: a full snapshot or a delta, read with the dictionary the welcome seeded
    if (item.bin) {
      NET.bytesIn += item.bin.length;
      try { msg = snapDecode(item.bin, NET.dictIn); } catch (e) { NET.refused = 'BYTES'; continue; }
      if (msg.t === 'full') { netClientApply(msg.snap); NET.synced = true; NET.lastTick = msg.tick; continue; }
      if (msg.t === 'snap') { if (NET.synced) netClientApplyDelta(msg); continue; }
      continue;
    }
    if (msg.t === 'closed') { NET.synced = false; continue; }    // the transport redials; HELLO again on open
    if (msg.t === 'refuse') { NET.refused = msg.why; continue; }
    if (msg.t === 'hostGone') { // the match ends here: a plate in play, the rooms list from the waiting room (updateTitle)
      NET.refused = 'HOSTGONE'; NET.synced = false;
      if (state.mode !== 'title' && state.over !== 'hostleft') endMatch('hostleft');
      continue;
    }
    if (msg.t === 'welcome') { netClientWelcome(msg); continue; }
    // the waiting room: the host's ten and its count, drawn here as there
    if (msg.t === 'roster') { netClientRoster(msg.roster); continue; }
    if (msg.t === 'count') { state.menu.countT = msg.t; state.menu.countN = msg.n; continue; }
  }
  if (T.open && !NET.helloed) { netClientHello(); NET.helloed = true; }
  if (!T.open) NET.helloed = false;
}
function netClientHello() {
  const c = PROFILE.char();
  NET.transport.send('host', { t: 'hello', uid: NET.uid, patch: PATCH_TXT, seed: SEED, name: c ? c.name : PROFILE.name(), cls: c ? c.cls : 0, look: c ? c.look : null });
}
// the roster the host dealt: our slot is the human here, the host's is a
// remote one, and the bodies are built before the first snapshot fills them
function netClientWelcome(msg) {
  const roster = msg.roster.map((r, i) => ({ control: i === msg.slot ? 'human' : r.control === 'human' ? 'remote' : r.control, team: r.team, name: r.name, cls: r.cls, look: r.look }));
  NET.hostSlot = msg.hostSlot;
  initPlayers(roster, msg.slot);
  camX = player.x - WV_W / 2; camY = player.y - WV_H / 2;
  NET.dictIn = encDict(); // the full sync that follows carries the host's whole list
  NET.welcomed = true; // the title screen moves to the waiting room on this
}
// a later roster (someone came or went while we wait): the bodies stay, their
// names, classes, faces and kinds change in place - ours stays the human
function netClientRoster(roster) {
  for (let i = 0; i < players.length && i < roster.length; i++) {
    const p = players[i], r = roster[i];
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
  const changed = snapApplyDelta(msg.d);
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
  netClientMode();
}
// every tick: each eased body moves from where it was drawn toward the
// host's position over one snapshot interval, so 15 snapshots a second read
// as motion rather than steps. A body the host stopped naming keeps its last
// target; the local player is eased like the rest (no prediction here)
function netClientLerp() {
  const now = performance.now(), period = SNAP_EVERY * TICK_DT * 1000;
  const ease = (e) => {
    if (e._t0 === undefined || e._t0 === 0) return;
    const k = Math.min(1, (now - e._t0) / period);
    e.x = e._fx + (e._tx - e._fx) * k; e.y = e._fy + (e._ty - e._fy) * k;
    if (k >= 1) e._t0 = 0;
  };
  for (const k in SNAP_KINDS) for (const e of SNAP_KINDS[k]()) ease(e);
  for (const p of players) ease(p);
  if (state.drop) for (const e of state.drop.eagles) ease(e);
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
