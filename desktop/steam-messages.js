// Steam's newer networking (ISteamNetworkingMessages), which steamworks.js
// (0.4, its latest) does not reach: messages to a SteamID over Steam's relay
// network (it hides every player's IP and gets through strict home routers),
// a real ping per peer, and messages up to 512 KB. Like steam-friends.js this
// calls the flat API of the steam_api DLL steamworks.js already loaded and
// initialised, through koffi. Any failure (koffi missing, an export renamed)
// leaves `ok` false: main.js then sends over the older P2P packets as before,
// and `--steamnet=p2p` picks the older path on purpose.
//
// Sessions: a peer's first message opens a session the other side must accept.
// Steam's session-request callback is out of koffi's reach, so `accept` is
// called with every member of the lobbies this process is in (main.js's pump,
// every ACCEPT_T): a stranger outside our lobbies is never accepted. Sending to
// a peer accepts its session too.
const path = require('path');

const SEND_UNRELIABLE = 0, SEND_NO_NAGLE = 1, SEND_RELIABLE = 8, SEND_AUTO_RESTART = 32;
const FLAGS_RELIABLE = SEND_RELIABLE | SEND_NO_NAGLE | SEND_AUTO_RESTART;
const FLAGS_UNRELIABLE = SEND_UNRELIABLE | SEND_NO_NAGLE | SEND_AUTO_RESTART;
const CHANNEL = 0;
const RECV_MAX = 64;          // messages taken per receive call
const MAX_MESSAGE = 512 * 1024; // k_cbMaxSteamNetworkingSocketsMessageSizeSend
const ID_SIZE = 136;          // sizeof(SteamNetworkingIdentity)
const ID_STEAMID = 16;        // k_ESteamNetworkingIdentityType_SteamID
const RESULT_OK = 1;          // k_EResultOK
// SteamNetworkingMessage_t, the SDK's 64-bit layout: m_pData at 0, m_cbSize at
// 8, then m_identityPeer at 16 {m_eType, m_cbSize, m_steamID64 at 24}
const MSG_HEAD = 32, MSG_SIZE_AT = 8, MSG_IDTYPE_AT = 16, MSG_STEAMID_AT = 24;
const STATUS_SIZE = 256;      // room for SteamNetConnectionRealTimeStatus_t (its first two ints: state, ping)
const STATE_NAMES = { 0: 'none', 1: 'connecting', 2: 'finding route', 3: 'connected', 4: 'closed', 5: 'problem' };

function dllPath() {
  if (process.env.SF_STEAM_API) return process.env.SF_STEAM_API; // a stand-in library, for a check off Steam
  const dist = path.join(path.dirname(require.resolve('steamworks.js')), 'dist');
  if (process.platform === 'win32') return path.join(dist, 'win64', 'steam_api64.dll');
  if (process.platform === 'darwin') return path.join(dist, 'osx', 'libsteam_api.dylib');
  return path.join(dist, 'linux64', 'libsteam_api.so');
}

function steamMessages() {
  const M = { ok: false, error: null, accepted: new Set() }; // accepted: the peers with a session, for forget and the log
  let api = null, koffi = null, self = null, ids = null, recv = null;
  try {
    koffi = require('koffi');
    const lib = koffi.load(dllPath());
    api = {
      messages: lib.func('void *SteamAPI_SteamNetworkingMessages_SteamAPI_v002()'),
      utils: lib.func('void *SteamAPI_SteamNetworkingUtils_SteamAPI_v004()'),
      relay: lib.func('void SteamAPI_ISteamNetworkingUtils_InitRelayNetworkAccess(void *self)'),
      setId: lib.func('void SteamAPI_SteamNetworkingIdentity_SetSteamID64(void *identity, uint64 id)'),
      send: lib.func('int SteamAPI_ISteamNetworkingMessages_SendMessageToUser(void *self, void *identity, const void *data, uint32 size, int flags, int channel)'),
      receive: lib.func('int SteamAPI_ISteamNetworkingMessages_ReceiveMessagesOnChannel(void *self, int channel, void *out, int max)'),
      accept: lib.func('bool SteamAPI_ISteamNetworkingMessages_AcceptSessionWithUser(void *self, void *identity)'),
      close: lib.func('bool SteamAPI_ISteamNetworkingMessages_CloseSessionWithUser(void *self, void *identity)'),
      info: lib.func('int SteamAPI_ISteamNetworkingMessages_GetSessionConnectionInfo(void *self, void *identity, void *info, _Out_ uint8_t *status)'),
      release: lib.func('void SteamAPI_SteamNetworkingMessage_t_Release(void *msg)'),
    };
    self = api.messages();
    if (!self) throw new Error('no ISteamNetworkingMessages');
    const utils = api.utils();
    if (utils) api.relay(utils); // start finding the relay network now, not on the first send
    ids = new Map();
    recv = Buffer.alloc(8 * RECV_MAX); // Steam writes RECV_MAX message pointers here
    M.ok = true;
  } catch (e) { M.error = e.message; api = null; }

  // one identity buffer per SteamID, kept: Steam reads it on every call
  function idOf(steamId) {
    const k = String(steamId);
    let b = ids.get(k);
    if (!b) { b = Buffer.alloc(ID_SIZE); api.setId(b, BigInt(k)); ids.set(k, b); }
    return b;
  }

  // bytes to a peer: true when Steam took them (a full reliable queue or a
  // message over MAX_MESSAGE is refused, and the caller's frames say so)
  M.send = (to, buf, reliable) => {
    if (!api || buf.length > MAX_MESSAGE) return false;
    M.accepted.add(String(to));
    return api.send(self, idOf(to), buf, buf.length, reliable === false ? FLAGS_UNRELIABLE : FLAGS_RELIABLE, CHANNEL) === RESULT_OK;
  };
  // Steam's bytes copied into our own (koffi.view only looks at them, and Steam frees them on release)
  const copy = (ptr, n) => Buffer.from(new Uint8Array(koffi.view(ptr, n)));
  // what has arrived: [{from, data: Buffer}], the data copied out before Steam frees it
  M.receive = () => {
    if (!api) return [];
    const out = [];
    for (;;) {
      const n = api.receive(self, CHANNEL, recv, RECV_MAX);
      const ptrs = n > 0 ? koffi.decode(recv, 'void *', n) : [];
      for (const p of ptrs) {
        try {
          const head = copy(p, MSG_HEAD);
          const size = head.readInt32LE(MSG_SIZE_AT);
          const data = size > 0 ? copy(koffi.decode(p, 'void *'), size) : Buffer.alloc(0);
          if (head.readInt32LE(MSG_IDTYPE_AT) === ID_STEAMID) out.push({ from: head.readBigUInt64LE(MSG_STEAMID_AT).toString(), data });
        } finally { api.release(p); }
      }
      if (n < RECV_MAX) return out;
    }
  };
  // a lobby member's session: Steam answers false until that member's first
  // message is waiting, so main.js asks for every member a few times a second
  // (never cached: a peer who restarts opens a new session to accept)
  M.accept = (steamId) => {
    if (!api || !api.accept(self, idOf(steamId))) return false;
    M.accepted.add(String(steamId));
    return true;
  };
  // a peer who left the lobby: its session closes
  M.forget = (steamId) => {
    const k = String(steamId);
    if (!api || !M.accepted.delete(k)) return;
    api.close(self, idOf(k));
  };
  // the session's state and ping, for the log
  M.status = (steamId) => {
    if (!api) return null;
    const st = Buffer.alloc(STATUS_SIZE);
    const state = api.info(self, idOf(steamId), null, st);
    return { state: STATE_NAMES[state] || String(state), ping: st.readInt32LE(4) };
  };
  return M;
}

module.exports = { steamMessages };
