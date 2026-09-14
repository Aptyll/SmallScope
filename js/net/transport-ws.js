// ------------------------------------------------------------ ws transport
// The transport for two tabs on one machine: the relay in app/server.js
// (`/ws?room=NAME&role=host|client`) forwards a client's frames to the room's
// host and a host's frames to the client it names. Same five calls as the
// loopback (js/net/net.js) and, later, Steam's sockets; JSON text frames for
// now - the wire form is cut from the snapshot later, not written beside it.
// Reliable and ordered, which is what a WebSocket is, so a delta against the
// last thing SENT is correct here; an unreliable channel needs the ack the
// plan describes (docs/pvp-architecture.md). A client that loses the socket
// reconnects on its own every WS_RETRY seconds with the same uid, and the
// host hands it its slot back (NET, js/net/net.js).
const WS_RETRY = 2;
function wsTransport(room) {
  const T = {
    room, sock: null, id: -1, open: false, queue: [], role: null, retryT: 0,
    connect() { this.role = 'client'; this.dial(); },
    listen() { this.role = 'host'; this.dial(); },
    dial() {
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(this.room) + '&role=' + this.role;
      let s; try { s = new WebSocket(url); } catch (e) { this.retryT = WS_RETRY; return; }
      s.onopen = () => { this.open = true; };
      s.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'relay') { this.id = m.id; return; } this.queue.push({ peer: m.peer === undefined ? 'host' : m.peer, msg: m }); };
      s.onclose = () => { this.open = false; this.sock = null; this.retryT = WS_RETRY; this.queue.push({ peer: 'host', msg: { t: 'closed' } }); };
      s.onerror = () => {};
      this.sock = s;
    },
    // a host names the client (or '*'); a client's frames only ever go to the host
    send(peer, msg) {
      if (!this.open || !this.sock) return false;
      if (this.role === 'host') msg.to = peer;
      this.sock.send(JSON.stringify(msg));
      return true;
    },
    poll(dt) {
      if (!this.sock && this.retryT > 0) { this.retryT -= dt || 0; if (this.retryT <= 0) this.dial(); }
      const out = this.queue; this.queue = []; return out;
    },
    close() { if (this.sock) { this.retryT = Infinity; this.sock.close(); } },
  };
  return T;
}
