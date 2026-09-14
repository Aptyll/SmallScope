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
// steamworks.js exposes Steam's older P2P sockets: reliable packets are
// capped at 1 MB and unreliable at 1200 bytes. Anything over STEAM_CHUNK
// goes as numbered parts on the reliable channel and is put back together
// here; everything is reliable in this cut, and the unreliable channel
// waits for the wire form that fits it (docs/pvp-architecture.md).
const STEAM_CHUNK = 900000;
const STEAM_LOBBY_MAX = 10;
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
        if (seed && seed !== SEED) { location.search = '?seed=' + seed + '&net=client&lobby=' + this.lobbyId; return; }
        this.wire();
        this.open = true;
      } catch (e) { this.error = String(e); }
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
      this.queue.push({ peer: this.role === 'client' ? 'host' : from, msg: m });
    },
    send(peer, msg) {
      if (!this.open) return false;
      const text = JSON.stringify(msg);
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
