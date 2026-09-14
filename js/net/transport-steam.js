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
// A message is text on the wire; the wire form's bytes (js/net/snapshot.js)
// go as base64 under {t:'bin'} and arrive as `bin`, the way the relay hands
// them over. steamworks.js exposes Steam's older P2P sockets: reliable packets are
// capped at 1 MB and unreliable at 1200 bytes. Anything over STEAM_CHUNK
// goes as numbered parts on the reliable channel and is put back together
// here; everything is reliable in this cut, and the unreliable channel
// waits for the wire form that fits it (docs/pvp-architecture.md).
const STEAM_CHUNK = 900000;
const STEAM_LOBBY_MAX = 10;
const STEAM_LIST_T = 2; // s between polls of the lobby list while the rooms screen is up
function steamB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function steamUnB64(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function steamTransport(lobbyId) {
  const T = {
    lobbyId: lobbyId ? String(lobbyId) : null, role: null, open: false, id: null, owner: null,
    queue: [], parts: new Map(), partSeq: 0, members: new Set(), error: null,
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
      this.bridge.onPackets((list) => { for (const pk of list) this.receive(pk.from, pk.text); });
      this.bridge.onEvent((ev) => {
        if (ev.t === 'chat' && ev.lobby === this.lobbyId && this.role === 'host' && ev.user !== this.id) {
          const entered = (ev.change & 1) !== 0; // Entered; anything else is a leaving
          if (entered) { this.members.add(ev.user); this.queue.push({ peer: ev.user, msg: { t: 'peer' } }); }
          else if (this.members.delete(ev.user)) this.queue.push({ peer: ev.user, msg: { t: 'gone' } });
        }
      });
    },
    receive(from, text) {
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
      if (m.t === 'bin') { this.queue.push({ peer, bin: steamUnB64(m.b) }); return; }
      this.queue.push({ peer, msg: m });
    },
    // what the rooms screen shows of this lobby (a host's call; values are strings in Steam's store)
    roomData(data) {
      if (!this.open || this.role !== 'host' || !this.lobbyId) return;
      const d = {}; for (const k of Object.keys(data)) d[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
      this.bridge.setLobbyData(this.lobbyId, d);
    },
    send(peer, msg) {
      if (!this.open) return false;
      const text = msg instanceof Uint8Array ? JSON.stringify({ t: 'bin', b: steamB64(msg) }) : JSON.stringify(msg);
      const targets = peer === '*' ? [...this.members] : [peer === 'host' ? this.owner : String(peer)];
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
