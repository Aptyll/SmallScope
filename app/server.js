// Minimal static file server for local dev - and the match relay (below),
// which is the same file because the relay is what Noah runs to host a
// night of games: `node app/server.js` on a machine with the port forwarded.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = +(process.env.PORT || 8471);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  if (req.url === '/ws-debug') { // the relay's rooms, for a harness to read
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(roomList(true))); return;
  }
  if (req.method === 'POST' && (req.url === '/shot' || req.url.startsWith('/shot?'))) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const b64 = body.replace(/^data:image\/png;base64,/, '');
      let out = path.join(ROOT, 'shot.png');
      const q = new URL(req.url, 'http://localhost').searchParams.get('f');
      if (q) {
        const safe = path.normalize(q).replace(/^([/\\])+/, '');
        out = path.join(ROOT, safe);
        if (!out.startsWith(ROOT) || !/\.(png|jpe?g)$/i.test(out)) {
          res.writeHead(400); res.end('bad path'); return;
        }
        fs.mkdirSync(path.dirname(out), { recursive: true });
      }
      fs.writeFileSync(out, Buffer.from(b64, 'base64'));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const head = {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
    };
    // Range requests matter for the music: an <audio> element served a plain 200
    // treats a multi-MB mp3 as an unbounded stream (duration Infinity) and
    // cannot seek in it. One range, which is all a media element ever asks for.
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      const last = data.length - 1;
      const start = m[1] ? +m[1] : Math.max(0, data.length - (+m[2] || 0));
      const end = m[1] ? Math.min(last, m[2] ? +m[2] : last) : last;
      if (start > last || start > end) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + data.length });
        res.end();
        return;
      }
      head['Content-Range'] = 'bytes ' + start + '-' + end + '/' + data.length;
      res.writeHead(206, head);
      res.end(data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, head);
    res.end(data);
  });
});

// ------------------------------------------------------------ ws relay
// The relay a match rides between screens: a browser, the wrapper, and one
// day a Steam transport all speak to it alike (js/net/transport-ws.js;
// docs/pvp-architecture.md). Dependency-free on purpose - the repo has no
// package manager - so the WebSocket handshake and framing are done here by
// hand: text frames, fragmentation, client frames masked, server frames not,
// lengths up to 2^53. The relay is dumb: it never reads a match. A ROOM has
// one host and any number of clients; a client's frame goes to the host
// tagged with the client's id, a host's frame carries `to` (a client id, or
// '*' for every client) and is forwarded without it; joining and leaving
// reach the host as {t:'peer'} / {t:'gone'}.
//   /ws?role=host              host a new room: the greeting carries its code
//   /ws?role=host&room=CODE    host a named room (the harness)
//   /ws?role=client&room=CODE  join one
//   /ws?role=list              be sent the open rooms now and on every change
// A host publishes what the list shows with {t:'room', data:{...}}: the
// host's name, the patch, the seed, the room's state, the humans in it. The
// list is public by design (Noah's ruling): a room is listed until its host
// leaves, and a client sees the patch so a mismatch reads as dimmed, not as a
// refusal at the door.
const rooms = new Map(); // code -> { host, clients: Map(id -> socket), data }
const listeners = new Set();
const ROOM_MAX = 64;
let nextPeer = 1;
function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: a code is read aloud
  for (let tries = 0; tries < 100; tries++) { let c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; }
  return null;
}
function roomList(all) {
  const out = [];
  for (const [code, r] of rooms) if (all || r.host) out.push({ room: code, n: r.clients.size + (r.host ? 1 : 0), data: r.data || {} });
  return out;
}
function tellListeners() { const msg = { t: 'rooms', rooms: roomList(false) }; for (const s of listeners) wsSend(s, msg); }
function wsAccept(key) { return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64'); }
function wsFrame(text) {
  const body = Buffer.from(text, 'utf8'), n = body.length;
  let head;
  if (n < 126) head = Buffer.from([0x81, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeUInt32BE(Math.floor(n / 0x100000000), 2); head.writeUInt32BE(n >>> 0, 6); }
  return Buffer.concat([head, body]);
}
function wsSend(sock, obj) { if (sock && !sock.destroyed) sock.write(wsFrame(JSON.stringify(obj))); }
// a binary frame (op 2): a snapshot's bytes, forwarded untouched but for the routing header
function wsFrameBin(body) {
  const n = body.length;
  let head;
  if (n < 126) head = Buffer.from([0x82, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x82; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x82; head[1] = 127; head.writeUInt32BE(Math.floor(n / 0x100000000), 2); head.writeUInt32BE(n >>> 0, 6); }
  return Buffer.concat([head, body]);
}
function wsSendBin(sock, body) { if (sock && !sock.destroyed) sock.write(wsFrameBin(body)); }
// parses every complete frame off a socket's buffer; returns the rest
function wsParse(sock, buf, onText, onBin) {
  let off = 0;
  for (;;) {
    if (buf.length - off < 2) break;
    const b0 = buf[off], b1 = buf[off + 1], op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, p = off + 2;
    if (len === 126) { if (buf.length - p < 2) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (buf.length - p < 8) break; len = buf.readUInt32BE(p) * 0x100000000 + buf.readUInt32BE(p + 4); p += 8; }
    if (masked && buf.length - p < 4) break;
    const mask = masked ? buf.subarray(p, p + 4) : null; if (masked) p += 4;
    if (buf.length - p < len) break;
    const body = Buffer.from(buf.subarray(p, p + len));
    if (mask) for (let i = 0; i < len; i++) body[i] ^= mask[i & 3];
    off = p + len;
    const fin = (b0 & 0x80) !== 0;
    // a browser fragments a big message (a full sync is megabytes): a text
    // frame opens it, continuation frames (op 0) carry the rest, FIN closes
    if (op === 1 || op === 2 || op === 0) {
      if (op !== 0) sock.fragBin = op === 2;
      sock.frag = sock.frag ? Buffer.concat([sock.frag, body]) : body;
      if (fin) { const whole = sock.frag; sock.frag = null; if (sock.fragBin) { if (onBin) onBin(whole); } else onText(whole.toString('utf8')); }
    } else if (op === 8) { sock.end(); return Buffer.alloc(0); }
    else if (op === 9) { const pong = Buffer.concat([Buffer.from([0x8a, body.length]), body]); sock.write(pong); }
  }
  return buf.subarray(off);
}
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const role = url.searchParams.get('role') === 'host' ? 'host' : url.searchParams.get('role') === 'list' ? 'list' : 'client';
  let room = (url.searchParams.get('room') || '').toUpperCase();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + wsAccept(req.headers['sec-websocket-key']) + '\r\n\r\n');
  const id = nextPeer++;
  let buf = Buffer.alloc(0);
  if (role === 'list') {
    listeners.add(sock);
    wsSend(sock, { t: 'relay', id, role });
    wsSend(sock, { t: 'rooms', rooms: roomList(false) });
    sock.on('data', (chunk) => { buf = wsParse(sock, Buffer.concat([buf, chunk]), () => wsSend(sock, { t: 'rooms', rooms: roomList(false) })); });
    const bye = () => listeners.delete(sock);
    sock.on('close', bye); sock.on('error', bye);
    return;
  }
  if (role === 'host' && !room) { room = makeCode(); if (!room || rooms.size >= ROOM_MAX) { wsSend(sock, { t: 'refuse', why: 'FULL' }); sock.end(); return; } }
  if (role === 'client' && !rooms.has(room)) { wsSend(sock, { t: 'refuse', why: 'NOROOM' }); sock.end(); return; }
  let r = rooms.get(room); if (!r) { r = { host: null, clients: new Map(), data: {} }; rooms.set(room, r); }
  console.log('ws ' + role + ' #' + id + ' joins room ' + room);
  if (role === 'host') {
    if (r.host) wsSend(r.host, { t: 'replaced' });
    r.host = sock;
    for (const cid of r.clients.keys()) wsSend(sock, { t: 'peer', peer: cid }); // clients already waiting
  } else {
    r.clients.set(id, sock);
    wsSend(r.host, { t: 'peer', peer: id });
  }
  wsSend(sock, { t: 'relay', id, role, room }); // the relay's own greeting - not the game's HELLO
  tellListeners();
  sock.on('data', (chunk) => {
    buf = wsParse(sock, Buffer.concat([buf, chunk]), (text) => {
      let msg; try { msg = JSON.parse(text); } catch (e) { return; }
      if (role === 'host') {
        if (msg.t === 'room') { r.data = msg.data || {}; tellListeners(); return; }
        const to = msg.to; delete msg.to;
        if (to === '*') for (const c of r.clients.values()) wsSend(c, msg);
        else wsSend(r.clients.get(+to), msg);
      } else { msg.peer = id; wsSend(r.host, msg); }
    }, (bin) => {
      // bytes: a host's carry the peer in front (0xFFFFFFFF for all), a client's get its id put in front
      if (role === 'host') {
        if (bin.length < 4) return;
        const to = bin.readUInt32BE(0), body = bin.subarray(4);
        if (to === 0xFFFFFFFF) for (const c of r.clients.values()) wsSendBin(c, body);
        else wsSendBin(r.clients.get(to), body);
      } else { const head = Buffer.alloc(4); head.writeUInt32BE(id, 0); wsSendBin(r.host, Buffer.concat([head, bin])); }
    });
  });
  const bye = () => {
    if (role === 'host') { if (r.host === sock) { r.host = null; for (const c of r.clients.values()) wsSend(c, { t: 'hostGone' }); } }
    else { r.clients.delete(id); wsSend(r.host, { t: 'gone', peer: id }); }
    if (!r.host && !r.clients.size) rooms.delete(room);
    tellListeners();
  };
  sock.on('close', bye); sock.on('error', bye);
});

server.listen(PORT, () => console.log('serving on http://localhost:' + PORT + ' (ws relay at /ws?role=host|client|list&room=CODE)'));
