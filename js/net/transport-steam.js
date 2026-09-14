// ------------------------------------------------------------ steam transport
// The transport for the wrapper (desktop/): a Steam lobby is the room, its
// owner is the host, and packets go peer to peer through Steam's relay -
// the same five calls as the loopback and the WebSocket relay (js/net/net.js),
// spoken to `window.steamBridge` (desktop/preload.js). A peer is named by
// its SteamID64 as a string. The bridge answers in promises, so the transport
// is a state machine the game polls: `open` turns true once the lobby is
// made or joined and the host is known.
//
// The host CREATES the lobby and writes what a joiner needs into its data -
// the patch, the seed, the room's state - before anyone can read it; a
// joiner whose page was born with another seed reloads itself onto the
// lobby's, since SEED is decided at load (js/core.js). Steam tells the host
// who came and went through the lobby's chat updates, which the transport
// turns into the same {t:'peer'} / {t:'gone'} the relay sends.
//
// A lobby's data is what the rooms screen lists (steamRooms below, polled
// every STEAM_LIST_T s from the bridge): the host writes its name, patch,
// seed, state and seat counts there (roomData, the same call the relay's
// room takes), and a lobby without a `patch` key is somebody else's test on
// the shared App ID and is not shown.
//
// A text message goes as JSON on the RELIABLE channel, chunked above STEAM_CHUNK
// into numbered text parts. The wire form's bytes (js/net/snapshot.js) go RAW,
// in binary frames - a 7-byte header (STEAM_MAGIC, a sequence, part index and
// part count) over the payload - and arrive as `bin`, the way the relay hands
// them over. steamworks.js exposes Steam's older P2P sockets: reliable packets
// are capped at 1 MB and unreliable at 1200 bytes. A frame the host marks LOSSY
// (a snapshot delta, netHostFlush) is split into STEAM_UNREL-byte parts on the
// UNRELIABLE channel when it fits STEAM_LOSSY_PARTS of them; a delta whose
// part never comes is dropped WHOLE here (the ack-keyed ring resends what it
// carried, docs/pvp-architecture.md) - never applied half, since a half delta
// is a world the host never had. Everything else - the full sync, the
// welcome, a client's inputs - stays reliable.
const STEAM_CHUNK = 900000;      // a reliable part's payload
const STEAM_UNREL = 1200;        // Steam's unreliable packet cap, header included
const STEAM_LOSSY_PARTS = 16;    // a lossy frame above this many parts goes reliable after all
const STEAM_FRAME_HDR = 7;
const STEAM_MAGIC = 0xB1;        // a frame's first byte; JSON text starts with '{'
const STEAM_PENDING = 16;        // sequences kept waiting for parts per peer before the oldest is given up
const STEAM_LOBBY_MAX = 10;
const STEAM_LIST_T = 2; // s between polls of the lobby list while the rooms screen is up
// the parts of one frame: header + slice, seq/i/n as little-endian u16
function steamFrames(u8, seq, payload) {
  const n = Math.max(1, Math.ceil(u8.length / payload)), out = [];
  for (let i = 0; i < n; i++) {
    const slice = u8.subarray(i * payload, (i + 1) * payload);
    const f = new Uint8Array(STEAM_FRAME_HDR + slice.length);
    f[0] = STEAM_MAGIC; f[1] = seq & 255; f[2] = seq >> 8; f[3] = i & 255; f[4] = i >> 8; f[5] = n & 255; f[6] = n >> 8;
    f.set(slice, STEAM_FRAME_HDR);
    out.push(f);
  }
  return out;
}
function steamTransport(lobbyId) {
  const T = {
    lobbyId: lobbyId ? String(lobbyId) : null, role: null, open: false, id: null, owner: null,
    queue: [], parts: new Map(), frames: new Map(), partSeq: 0, lost: 0, members: new Set(), error: null,
    bridge: window.steamBridge,
    async listen() {
      this.role = 'host';
      try {
        const info = await this.bridge.info();
        if (!info.ready) { this.error = info.error || 'STEAM'; return; }
        this.id = info.id;
        const l = await this.bridge.createLobby('public', STEAM_LOBBY_MAX);
        this.lobbyId = l.id; this.owner = l.owner;
        await this.bridge.setLobbyData(l.id, { patch: PATCH_TXT, seed: String(SEED), state: 'open', name: info.name || '' });
        this.wire();
        this.open = true;
      } catch (e) { this.error = String(e); }
      if (this.bridge.log) this.bridge.log('host ' + (this.open ? 'lobby ' + this.lobbyId : 'error ' + this.error));
    },
    async connect() {
      this.role = 'client';
      try {
        const info = await this.bridge.info();
        if (!info.ready) { this.error = info.error || 'STEAM'; return; }
        this.id = info.id;
        const l = await this.bridge.joinLobby(this.lobbyId);
        this.owner = l.owner;
        // the world is the lobby's: a page born on another seed starts over on it
        const seed = parseInt(l.data.seed, 10);
        if (seed && seed !== SEED) { location.search = '?seed=' + seed + '&net=client&lobby=' + this.lobbyId + '&transport=steam'; return; }
        this.wire();
        this.open = true;
      } catch (e) { this.error = String(e); }
      if (this.bridge.log) this.bridge.log('client ' + (this.open ? 'joined ' + this.lobbyId : 'error ' + this.error));
    },
    wire() {
      if (this.wired) return; this.wired = true;
      this.bridge.onPackets((list) => { for (const pk of list) this.receive(pk.from, pk.text, pk.bin); });
      this.bridge.onEvent((ev) => {
        if (ev.t === 'chat' && ev.lobby === this.lobbyId && this.role === 'host' && ev.user !== this.id) {
          const entered = (ev.change & 1) !== 0; // Entered; anything else is a leaving
          if (entered) { this.members.add(ev.user); this.queue.push({ peer: ev.user, msg: { t: 'peer' } }); }
          else if (this.members.delete(ev.user)) this.queue.push({ peer: ev.user, msg: { t: 'gone' } });
        }
      });
    },
    receive(from, text, bin) {
      if (bin) { this.receiveFrame(from, bin); return; }
      let m; try { m = JSON.parse(text); } catch (e) { return; }
      if (m.t === 'part') {
        const key = from + ':' + m.id;
        let p = this.parts.get(key); if (!p) { p = { n: m.n, got: 0, s: new Array(m.n) }; this.parts.set(key, p); }
        p.s[m.i] = m.s; p.got++;
        if (p.got < p.n) return;
        this.parts.delete(key);
        try { m = JSON.parse(p.s.join('')); } catch (e) { return; }
      }
      const peer = this.role === 'client' ? 'host' : from;
      this.queue.push({ peer, msg: m });
    },
    // one part of a binary frame in: kept under its peer and sequence until
    // every part is here, then handed over whole; a sequence STEAM_PENDING
    // behind the newest from that peer is given up (`lost` counts them)
    receiveFrame(from, u8) {
      if (u8.length < STEAM_FRAME_HDR || u8[0] !== STEAM_MAGIC) return;
      const seq = u8[1] | (u8[2] << 8), i = u8[3] | (u8[4] << 8), n = u8[5] | (u8[6] << 8);
      if (!n || i >= n) return;
      let pend = this.frames.get(from); if (!pend) { pend = new Map(); this.frames.set(from, pend); }
      let p = pend.get(seq);
      if (!p) {
        p = { n, got: 0, s: new Array(n), size: 0 }; pend.set(seq, p);
        for (const [old, q] of pend) if (((seq - old) & 0xFFFF) > STEAM_PENDING && ((seq - old) & 0xFFFF) < 0x8000) { pend.delete(old); if (!q.done) this.lost++; }
      }
      if (p.done || p.s[i]) return; // a repeat (a whole frame stays marked done until it ages out, so a late repeat cannot start it over)
      p.s[i] = u8.subarray(STEAM_FRAME_HDR); p.got++; p.size += p.s[i].length;
      if (p.got < p.n) return;
      const bin = new Uint8Array(p.size); let at = 0;
      for (const part of p.s) { bin.set(part, at); at += part.length; }
      p.done = true; p.s = null;
      this.queue.push({ peer: this.role === 'client' ? 'host' : from, bin });
    },
    // what the rooms screen shows of this lobby (a host's call; values are strings in Steam's store)
    roomData(data) {
      if (!this.open || this.role !== 'host' || !this.lobbyId) return;
      const d = {}; for (const k of Object.keys(data)) d[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
      this.bridge.setLobbyData(this.lobbyId, d);
    },
    send(peer, msg, lossy) {
      if (!this.open) return false;
      const targets = peer === '*' ? [...this.members] : [peer === 'host' ? this.owner : String(peer)];
      if (ArrayBuffer.isView(msg)) { // bytes (a Uint8Array, whichever realm made it)
        const unrel = lossy && msg.length <= STEAM_LOSSY_PARTS * (STEAM_UNREL - STEAM_FRAME_HDR);
        const frames = steamFrames(msg, (this.partSeq = (this.partSeq + 1) & 0xFFFF), unrel ? STEAM_UNREL - STEAM_FRAME_HDR : STEAM_CHUNK);
        for (const to of targets) for (const f of frames) this.bridge.send(to, f, !unrel);
        return true;
      }
      const text = JSON.stringify(msg);
      for (const to of targets) {
        if (text.length <= STEAM_CHUNK) { this.bridge.send(to, text, true); continue; }
        const id = ++this.partSeq, n = Math.ceil(text.length / STEAM_CHUNK);
        for (let i = 0; i < n; i++) this.bridge.send(to, JSON.stringify({ t: 'part', id, i, n, s: text.slice(i * STEAM_CHUNK, (i + 1) * STEAM_CHUNK) }), true);
      }
      return true;
    },
    poll() { const out = this.queue; this.queue = []; return out; },
    close() { if (this.lobbyId) this.bridge.leaveLobby(this.lobbyId); this.open = false; },
  };
  return T;
}
// The rooms screen's feed of Steam lobbies, in the shape the relay's list
// sends (wsRooms, js/net/transport-ws.js): { room: lobby id, n: members,
// data: { name, patch, seed, state, humans, sides } }, the numbers parsed
// back out of Steam's string store. Polled while the screen is up; close()
// stops it. Lobbies without a patch key are not this game's.
function steamRooms(cb) {
  const bridge = window.steamBridge;
  let timer = null, closed = false;
  const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  const poll = async () => {
    if (closed) return;
    try {
      const info = await bridge.info();
      if (!info.ready) { cb([], false); return; }
      const list = await bridge.lobbies();
      const rooms = [];
      for (const l of list) {
        const d = l.data || {};
        if (!d.patch) continue;
        let sides = [0, 0]; try { sides = JSON.parse(d.sides || '[0,0]'); } catch (e) {}
        rooms.push({ room: l.id, n: (l.members || []).length, data: { name: d.name || '', patch: d.patch, seed: num(d.seed), state: d.state || 'open', humans: num(d.humans), sides } });
      }
      if (!closed) cb(rooms, true);
    } catch (e) { if (!closed) cb([], false); }
  };
  poll();
  timer = setInterval(poll, STEAM_LIST_T * 1000);
  return { close() { closed = true; if (timer) clearInterval(timer); } };
}
