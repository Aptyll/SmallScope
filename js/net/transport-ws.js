// ------------------------------------------------------------ ws transport
// The transport every screen speaks first: the relay in app/server.js
// (`/ws?role=host|client&room=CODE`), which forwards a client's frames to
// the room's host and a host's frames to the client it names. A browser at
// a served address, the wrapper at file://, and one machine playing against
// itself in two windows all reach the same relay (docs/pvp-architecture.md).
// Same five calls as the loopback and Steam's; JSON text frames for now -
// the wire form is cut from the snapshot later, not written beside it.
// Reliable and ordered, which is what a WebSocket is, so a delta against the
// last thing SENT is correct here; an unreliable channel needs the ack the
// plan describes. A client that loses the socket redials on its own every
// WS_RETRY seconds with the same uid, and the host hands it its slot back.
//
// The RELAY ADDRESS (host:port) is netRelay()'s to decide (js/net/net.js);
// a host hands no room and is given a code by the relay's greeting, a client
// hands the code it picked off the list. wsRooms() is the list itself: a
// socket in the `list` role the relay pushes the open rooms to, kept for as
// long as the screen that asked is up.
const WS_RETRY = 2;
function wsUrl(relay, params) {
  const secure = location.protocol === 'https:' || /^wss:/.test(relay);
  const host = relay.replace(/^wss?:\/\//, '').replace(/\/+$/, '');
  return (secure ? 'wss://' : 'ws://') + host + '/ws?' + params;
}
function wsTransport(relay, room) {
  const T = {
    relay, room: room ? String(room).toUpperCase() : null, sock: null, id: -1, open: false, queue: [], role: null, retryT: 0, error: null,
    connect() { this.role = 'client'; this.dial(); },
    listen() { this.role = 'host'; this.dial(); },
    dial() {
      const params = 'role=' + this.role + (this.room ? '&room=' + encodeURIComponent(this.room) : '');
      let s; try { s = new WebSocket(wsUrl(this.relay, params)); } catch (e) { this.error = String(e); this.retryT = WS_RETRY; return; }
      s.onopen = () => { this.error = null; };
      s.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'relay') { this.id = m.id; if (m.room) this.room = m.room; this.open = true; return; }
        if (m.t === 'refuse' && !this.open) { this.error = m.why; this.retryT = Infinity; return; } // no such room: do not redial
        this.queue.push({ peer: m.peer === undefined ? 'host' : m.peer, msg: m });
      };
      s.onclose = () => { this.open = false; this.sock = null; if (this.retryT !== Infinity) this.retryT = WS_RETRY; this.queue.push({ peer: 'host', msg: { t: 'closed' } }); };
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
    // what the list shows of this room (a host's call)
    roomData(data) { if (this.open && this.sock && this.role === 'host') this.sock.send(JSON.stringify({ t: 'room', data })); },
    poll(dt) {
      if (!this.sock && this.retryT > 0 && this.retryT !== Infinity) { this.retryT -= dt || 0; if (this.retryT <= 0) this.dial(); }
      const out = this.queue; this.queue = []; return out;
    },
    close() { this.retryT = Infinity; this.open = false; if (this.sock) this.sock.close(); this.sock = null; },
  };
  return T;
}
// the open rooms, live: cb(rooms) on connect and on every change; .close() when done
function wsRooms(relay, cb) {
  let sock = null, closed = false, retry = null;
  const dial = () => {
    if (closed) return;
    try { sock = new WebSocket(wsUrl(relay, 'role=list')); } catch (e) { retry = setTimeout(dial, WS_RETRY * 1000); return; }
    sock.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'rooms') cb(m.rooms, true); };
    sock.onclose = () => { sock = null; cb([], false); if (!closed) retry = setTimeout(dial, WS_RETRY * 1000); };
    sock.onerror = () => {};
  };
  dial();
  return { close() { closed = true; if (retry) clearTimeout(retry); if (sock) sock.close(); } };
}
