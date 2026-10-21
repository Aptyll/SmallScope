// Steam's friends, which steamworks.js (0.4, its latest) does not reach: the
// friends list, who is in Softfall and in which lobby, an invite straight to
// one friend, the overlay's add-friend page, and the players met in a match.
// These call steam_api64.dll's flat API through koffi - the same DLL, already
// loaded and initialised by steamworks.js in this process, so nothing here
// inits or shuts Steam down. Any failure (koffi missing, the DLL's exports
// renamed) leaves `ok` false and every call a harmless no-op: the page then
// hides its friends panel and codes work as before (js/ui/friends.js).
const path = require('path');

const FRIEND_FLAG_IMMEDIATE = 0x04;   // k_EFriendFlagImmediate: real friends, not group members or requests
const REL_FRIEND = 3;                 // k_EFriendRelationshipFriend
const OVERLAY_DIALOGS = ['friendadd', 'steamid', 'chat']; // what the page may open on a user
const RP_KEYS = ['status', 'connect', 'sf_lobby', 'sf_mode', 'sf_n', 'sf_state', 'sf_patch', 'sf_hero']; // the rich presence the page may set
const RECENT_KEEP = 12;               // players met kept for the panel
const COPLAY_KEEP = 40;               // Steam's own recent-players list is read this far

function dllPath() {
  const dist = path.join(path.dirname(require.resolve('steamworks.js')), 'dist');
  if (process.platform === 'win32') return path.join(dist, 'win64', 'steam_api64.dll');
  if (process.platform === 'darwin') return path.join(dist, 'osx', 'libsteam_api.dylib');
  return path.join(dist, 'linux64', 'libsteam_api.so');
}

function steamFriends(appId) {
  const F = { ok: false, error: null, recent: new Map() };
  let api = null;
  try {
    const koffi = require('koffi');
    const lib = koffi.load(dllPath());
    const GameInfo = koffi.struct('SfFriendGameInfo', { gameID: 'uint64', ip: 'uint32', port: 'uint16', qport: 'uint16', lobby: 'uint64' });
    api = {
      friends: lib.func('void *SteamAPI_SteamFriends_v017()'),
      mm: lib.func('void *SteamAPI_SteamMatchmaking_v009()'),
      count: lib.func('int SteamAPI_ISteamFriends_GetFriendCount(void *self, int flags)'),
      byIndex: lib.func('uint64 SteamAPI_ISteamFriends_GetFriendByIndex(void *self, int i, int flags)'),
      name: lib.func('const char *SteamAPI_ISteamFriends_GetFriendPersonaName(void *self, uint64 id)'),
      state: lib.func('int SteamAPI_ISteamFriends_GetFriendPersonaState(void *self, uint64 id)'),
      rel: lib.func('int SteamAPI_ISteamFriends_GetFriendRelationship(void *self, uint64 id)'),
      game: lib.func('bool SteamAPI_ISteamFriends_GetFriendGamePlayed(void *self, uint64 id, _Out_ SfFriendGameInfo *out)'),
      rp: lib.func('const char *SteamAPI_ISteamFriends_GetFriendRichPresence(void *self, uint64 id, const char *key)'),
      setRp: lib.func('bool SteamAPI_ISteamFriends_SetRichPresence(void *self, const char *key, const char *value)'),
      overlayUser: lib.func('void SteamAPI_ISteamFriends_ActivateGameOverlayToUser(void *self, const char *dialog, uint64 id)'),
      overlay: lib.func('void SteamAPI_ISteamFriends_ActivateGameOverlay(void *self, const char *dialog)'),
      playedWith: lib.func('void SteamAPI_ISteamFriends_SetPlayedWith(void *self, uint64 id)'),
      coplayN: lib.func('int SteamAPI_ISteamFriends_GetCoplayFriendCount(void *self)'),
      coplay: lib.func('uint64 SteamAPI_ISteamFriends_GetCoplayFriend(void *self, int i)'),
      coplayApp: lib.func('uint32 SteamAPI_ISteamFriends_GetFriendCoplayGame(void *self, uint64 id)'),
      invite: lib.func('bool SteamAPI_ISteamMatchmaking_InviteUserToLobby(void *self, uint64 lobby, uint64 id)'),
    };
    if (!api.friends() || !api.mm()) throw new Error('no ISteamFriends');
    F.ok = true;
  } catch (e) { F.error = e.message; api = null; }

  const S = (v) => String(v);
  const B = (v) => BigInt(String(v));
  const self = () => api.friends();
  const rpOf = (id, k) => api.rp(self(), id, k) || '';
  // one person as the page sees them: name, persona state (0 offline .. 6),
  // whether they are in Softfall, and in Softfall their lobby and what their
  // rich presence says of it (set by the page's own friendsPresence)
  function person(id) {
    const gi = {};
    const inGame = api.game(self(), id, gi) && Number(BigInt(gi.gameID) & 0xFFFFFFn) === appId;
    const p = { id: S(id), name: api.name(self(), id) || '', st: api.state(self(), id), game: inGame };
    if (inGame) {
      const lobby = gi.lobby ? S(gi.lobby) : '0';
      p.lobby = lobby !== '0' ? lobby : rpOf(id, 'sf_lobby');
      p.mode = rpOf(id, 'sf_mode'); p.n = parseInt(rpOf(id, 'sf_n'), 10) || 0;
      p.state = rpOf(id, 'sf_state'); p.patch = rpOf(id, 'sf_patch'); p.hero = rpOf(id, 'sf_hero');
    }
    return p;
  }
  F.list = (myId) => {
    if (!F.ok) return { ok: false, error: F.error };
    const out = [], seen = new Set();
    const n = api.count(self(), FRIEND_FLAG_IMMEDIATE);
    for (let i = 0; i < n; i++) { const id = api.byIndex(self(), i, FRIEND_FLAG_IMMEDIATE); seen.add(S(id)); out.push(person(id)); }
    // players met: this run's (playedWith below) and Steam's own recent list for Softfall, friends left out
    const recent = [];
    const add = (id, name) => {
      const s = S(id);
      if (seen.has(s) || s === String(myId) || recent.length >= RECENT_KEEP) return;
      seen.add(s);
      recent.push({ id: s, name: api.name(self(), B(s)) || name || '', st: api.state(self(), B(s)) });
    };
    for (const [id, r] of [...F.recent].reverse()) add(id, r.name);
    const cn = Math.min(COPLAY_KEEP, api.coplayN(self()));
    for (let i = 0; i < cn; i++) { const id = api.coplay(self(), i); if (api.coplayApp(self(), id) === appId) add(id); }
    return { ok: true, friends: out, recent };
  };
  F.isFriend = (id) => F.ok && api.rel(self(), B(id)) === REL_FRIEND;
  F.nameOf = (id) => (F.ok ? api.name(self(), B(id)) || '' : '');
  F.invite = (lobby, id) => F.ok && api.invite(api.mm(), B(lobby), B(id));
  F.overlayUser = (dialog, id) => { if (F.ok && OVERLAY_DIALOGS.includes(dialog)) api.overlayUser(self(), dialog, B(id)); return F.ok; };
  F.overlay = () => { if (F.ok) api.overlay(self(), 'friends'); return F.ok; };
  F.presence = (kv) => {
    if (!F.ok || !kv) return false;
    for (const k of RP_KEYS) if (k in kv) api.setRp(self(), k, kv[k] == null ? '' : String(kv[k]).slice(0, 255));
    return true;
  };
  // everyone else in the lobby: marked as played with (Steam's Recent
  // Players) and kept for the panel's recent rows while the game runs
  F.playedWith = (ids, myId) => {
    if (!F.ok) return [];
    for (const s of ids) {
      if (String(s) === String(myId)) continue;
      api.playedWith(self(), B(s));
      F.recent.delete(String(s));
      F.recent.set(String(s), { name: F.nameOf(s) });
      while (F.recent.size > RECENT_KEEP) F.recent.delete(F.recent.keys().next().value);
    }
    return [...F.recent.keys()];
  };
  return F;
}

module.exports = { steamFriends };
