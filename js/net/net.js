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
  peers: [],                 // a host's connected peers: { id, slot, lastInputTick }
};

// The transport interface every adapter implements - the loopback here, a
// local WebSocket relay for two tabs on one machine (step 5), Steam's
// networking sockets from the wrapper (step 6):
//   connect(hostId)            client: open a session to the host
//   listen()                   host: accept sessions
//   send(peer, bytes, reliable)
//   poll() -> [{ peer, bytes }]
//   close(peer)
// The loopback has no peers: send drops, poll is empty. It exists so that the
// host code path runs unchanged in solo, with nothing to receive.
const loopbackTransport = {
  connect() {},
  listen() {},
  send() {},
  poll() { return []; },
  close() {},
};

function netSetup(role, transport) {
  NET.role = role || 'solo';
  NET.transport = transport || loopbackTransport;
  NET.peers.length = 0;
}
netSetup('solo');
