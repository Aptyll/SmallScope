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
// plan describes. A socket that drops redials on its own with the same uid
// (the host hands a client its slot back), first after WS_RETRY seconds and
// twice as long after each failure up to WS_RETRY_MAX, so a relay that is
// down never costs a frame. A socket that never once reached the relay stops
// after WS_GIVEUP tries with error NORELAY: a page with no relay behind its
// address (the web build on a static host, the wrapper with none running)
// plays on alone, and no room was ever handed out that anyone could join.
//
// The RELAY ADDRESS (host:port) is netRelay()'s to decide (js/net/net.js);
// a host hands no room and is given a code by the relay's greeting, a client
// hands the code it picked off the list. wsRooms() is the list itself: a
// socket in the `list` role the relay pushes the open rooms to, kept for as
// long as the screen that asked is up.
const WS_RETRY = 2;       // s before the first redial
const WS_RETRY_MAX = 30;  // s: the longest wait the doubling reaches
const WS_GIVEUP = 3;      // failed dials before a socket that never opened stops
// the wait before redial n (1, 2, ...): WS_RETRY, doubled each time, capped
function wsBackoff(n) { return Math.min(WS_RETRY_MAX, WS_RETRY * Math.pow(2, Math.max(0, n - 1))); }
function wsUrl(relay, params) {
  const secure = location.protocol === 'https:' || /^wss:/.test(relay);
  const host = relay.replace(/^wss?:\/\//, '').replace(/\/+$/, '');
  return (secure ? 'wss://' : 'ws://') + host + '/ws?' + params;
}
function wsTransport(relay, room) {
  const T = {
    relay, room: room ? String(room).toUpperCase() : null, sock: null, id: -1, open: false, queue: [], role: null, retryT: 0, error: null,
    fails: 0,      // dials in a row that ended without the relay's greeting
    reached: false, // has this socket ever been greeted: one that has keeps redialing
    connect() { this.role = 'client'; this.dial(); },
    listen() { this.role = 'host'; this.dial(); },
    // a dial that ended without a greeting: wait longer before the next, or
    // stop for good when the relay was never there at all
    failed(why) {
      this.fails++;
      if (!this.reached && this.fails >= WS_GIVEUP) { this.error = 'NORELAY'; this.retryT = Infinity; return; }
      if (why) this.error = why;
      this.retryT = wsBackoff(this.fails);
    },
    dial() {
      const params = 'role=' + this.role + (this.room ? '&room=' + encodeURIComponent(this.room) : '');
      let s; try { s = new WebSocket(wsUrl(this.relay, params)); } catch (e) { this.failed(String(e)); return; }
      s.binaryType = 'arraybuffer';
      s.onopen = () => { this.error = null; };
      s.onmessage = (ev) => {
        // a binary frame is a snapshot's bytes (js/net/snapshot.js): a host's
        // arrive bare, a client's with the relay's 4-byte peer id in front
        if (ev.data instanceof ArrayBuffer) {
          const u = new Uint8Array(ev.data);
          if (this.role === 'host') this.queue.push({ peer: new DataView(ev.data).getUint32(0), bin: u.subarray(4) });
          else this.queue.push({ peer: 'host', bin: u });
          return;
        }
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'relay') { this.id = m.id; if (m.room) this.room = m.room; this.open = true; this.reached = true; this.fails = 0; return; }
        if (m.t === 'refuse' && !this.open) { this.error = m.why; this.retryT = Infinity; return; } // no such room: do not redial
        // another host took this room (the relay routes to it now): stand down
        // rather than redial and take it back, or the two would swap it forever
        if (m.t === 'replaced') { this.error = 'REPLACED'; this.close(); return; }
        this.queue.push({ peer: m.peer === undefined ? 'host' : m.peer, msg: m });
      };
      s.onclose = () => {
        const was = this.open;
        this.open = false; this.sock = null;
        if (this.retryT !== Infinity) { if (was) { this.fails = 0; this.retryT = WS_RETRY; } else this.failed(); }
        this.queue.push({ peer: 'host', msg: { t: 'closed' } });
      };
      s.onerror = () => {};
      this.sock = s;
    },
    // a host names the client (or '*'); a client's frames only ever go to the host
    send(peer, msg) {
      if (!this.open || !this.sock) return false;
      if (msg instanceof Uint8Array) {
        // bytes: a host's carry the peer in front (0xFFFFFFFF for every client)
        if (this.role !== 'host') { this.sock.send(msg); return true; }
        const out = new Uint8Array(4 + msg.length);
        new DataView(out.buffer).setUint32(0, peer === '*' ? 0xFFFFFFFF : +peer);
        out.set(msg, 4);
        this.sock.send(out);
        return true;
      }
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
// (the same doubling wait between redials, and the same stop when the relay was never there)
function wsRooms(relay, cb) {
  let sock = null, closed = false, retry = null, fails = 0, reached = false;
  const again = () => {
    fails++;
    if (closed || (!reached && fails >= WS_GIVEUP)) return;
    retry = setTimeout(dial, wsBackoff(fails) * 1000);
  };
  const dial = () => {
    if (closed) return;
    try { sock = new WebSocket(wsUrl(relay, 'role=list')); } catch (e) { again(); return; }
    sock.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (m.t === 'rooms') { reached = true; fails = 0; cb(m.rooms, true); } };
    sock.onclose = () => { sock = null; cb([], false); again(); };
    sock.onerror = () => {};
  };
  dial();
  return { close() { closed = true; if (retry) clearTimeout(retry); if (sock) sock.close(); } };
}
