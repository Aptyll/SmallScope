// THE GLOBAL LADDER's Steam side: one Steam leaderboard of RANKED ratings,
// which steamworks.js (0.4, its latest) does not reach. The page posts its
// rating with its player card packed into the entry's details and reads the
// top of the board and the rows around itself (js/app/board.js). Like
// steam-friends.js this calls the flat API of the steam_api DLL steamworks.js
// already loaded and initialised, through koffi.
//
// Every leaderboard call is asynchronous: Steam answers it later as a "call
// result" on a pipe. steamworks.js runs Steam's manual dispatch on the main
// pipe and takes every call result it finds there, ours included, so these
// calls ride A PIPE OF OUR OWN (CreateSteamPipe + ConnectToGlobalUser, the
// same signed-in user) and `pump` drains it: nothing of ours reaches
// steamworks.js's queue, and nothing of its reaches ours. Any failure (koffi
// missing, an export renamed, no pipe) leaves `ok` false and every call
// answers { ok: false }: the page then shows the people this screen met, as
// it did before the board.
const path = require('path');

const BOARD_NAME = 'ranked_rating';
const SORT_DESC = 2;            // k_ELeaderboardSortMethodDescending: the highest rating is rank 1
const SHOW_NUMBER = 1;          // k_ELeaderboardDisplayTypeNumeric
const POST_FORCE = 2;           // k_ELeaderboardUploadScoreMethodForceUpdate: a rating goes down as well as up
const ASK_GLOBAL = 0, ASK_AROUND = 1; // k_ELeaderboardDataRequestGlobal, ...GlobalAroundUser
const DETAILS_MAX = 64;         // k_cLeaderboardDetailsMax: int32s an entry may carry
const SCORE_MAX = 1e7;          // a rating past this is a hand edit (MH_NUM_MAX, js/app/history.js)
const ROWS_MAX = 200;           // rows one read may ask for, the top and around together
const CB_DONE = 703;            // SteamAPICallCompleted_t::k_iCallback
const CB_FIND = 1104, CB_DOWN = 1105, CB_UP = 1106; // LeaderboardFindResult_t, LeaderboardScoresDownloaded_t, LeaderboardScoreUploaded_t
const WAIT_MAX = 15000;         // ms a call may take before it is given up
const PUMP_BUSY = 30, PUMP_IDLE = 500; // ms between drains of the pipe, with a call out and without
// The result structs' layout: Windows packs Steam's callback structs to 8,
// Linux and macOS to 4 (VALVE_CALLBACK_PACK_LARGE / _SMALL, steamclientpublic.h).
// SF_STEAM_PACK picks one for a stand-in library, for a check off Steam.
const PACK = process.env.SF_STEAM_PACK ? Number(process.env.SF_STEAM_PACK) : process.platform === 'win32' ? 8 : 4;
const AT = PACK === 8
  ? { find: 16, found: 8, down: 24, entries: 8, count: 16, up: 32, upOk: 0, rankNew: 24, rankOld: 28, entry: 32, eRank: 8, eScore: 12, eDetails: 16 }
  : { find: 12, found: 8, down: 20, entries: 8, count: 16, up: 28, upOk: 0, rankNew: 20, rankOld: 24, entry: 28, eRank: 8, eScore: 12, eDetails: 16 };

function dllPath() {
  if (process.env.SF_STEAM_API) return process.env.SF_STEAM_API; // a stand-in library, for a check off Steam
  const dist = path.join(path.dirname(require.resolve('steamworks.js')), 'dist');
  if (process.platform === 'win32') return path.join(dist, 'win64', 'steam_api64.dll');
  if (process.platform === 'darwin') return path.join(dist, 'osx', 'libsteam_api.dylib');
  return path.join(dist, 'linux64', 'libsteam_api.so');
}

function steamBoard(slog) {
  const S = { ok: false, error: null };
  const log = slog || (() => { });
  let api = null, koffi = null, client = null, pipe = 0, user = 0, stats = null, Done = null;
  try {
    koffi = require('koffi');
    const lib = koffi.load(dllPath());
    const Msg = koffi.struct('SfCallbackMsg', { user: 'int32', cb: 'int', param: 'void *', cub: 'int' });
    Done = koffi.struct('SfCallCompleted', { call: 'uint64', cb: 'int', cub: 'uint32' });
    api = {
      client: lib.func('void *SteamClient()'),
      newPipe: lib.func('int32 SteamAPI_ISteamClient_CreateSteamPipe(void *self)'),
      dropPipe: lib.func('bool SteamAPI_ISteamClient_BReleaseSteamPipe(void *self, int32 pipe)'),
      connect: lib.func('int32 SteamAPI_ISteamClient_ConnectToGlobalUser(void *self, int32 pipe)'),
      dropUser: lib.func('void SteamAPI_ISteamClient_ReleaseUser(void *self, int32 pipe, int32 user)'),
      stats: lib.func('void *SteamAPI_ISteamClient_GetISteamUserStats(void *self, int32 user, int32 pipe, const char *version)'),
      frame: lib.func('void SteamAPI_ManualDispatch_RunFrame(int32 pipe)'),
      next: lib.func('bool SteamAPI_ManualDispatch_GetNextCallback(int32 pipe, _Out_ SfCallbackMsg *msg)'),
      free: lib.func('void SteamAPI_ManualDispatch_FreeLastCallback(int32 pipe)'),
      result: lib.func('bool SteamAPI_ManualDispatch_GetAPICallResult(int32 pipe, uint64 call, void *out, int size, int cb, _Out_ bool *failed)'),
      find: lib.func('uint64 SteamAPI_ISteamUserStats_FindOrCreateLeaderboard(void *self, const char *name, int sort, int show)'),
      count: lib.func('int SteamAPI_ISteamUserStats_GetLeaderboardEntryCount(void *self, uint64 board)'),
      download: lib.func('uint64 SteamAPI_ISteamUserStats_DownloadLeaderboardEntries(void *self, uint64 board, int ask, int from, int to)'),
      entry: lib.func('bool SteamAPI_ISteamUserStats_GetDownloadedLeaderboardEntry(void *self, uint64 entries, int i, void *entry, void *details, int max)'),
      upload: lib.func('uint64 SteamAPI_ISteamUserStats_UploadLeaderboardScore(void *self, uint64 board, int how, int32 score, void *details, int n)'),
    };
    client = api.client();
    if (!client) throw new Error('no ISteamClient');
    pipe = api.newPipe(client);
    if (!pipe) throw new Error('no pipe');
    user = api.connect(client, pipe);
    if (!user) { api.dropPipe(client, pipe); pipe = 0; throw new Error('no user on the pipe'); }
    stats = api.stats(client, user, pipe, 'STEAMUSERSTATS_INTERFACE_VERSION012');
    if (!stats) throw new Error('no ISteamUserStats');
    S.ok = true;
  } catch (e) {
    S.error = e.message;
    if (api && client && pipe) { try { if (user) api.dropUser(client, pipe, user); api.dropPipe(client, pipe); } catch (err) { } }
    api = null;
  }

  // ---- call results: each call's promise, settled when the pipe answers it
  const waiting = new Map(); // call id (string) -> { cb, size, done(buf|null), at }
  let pumpT = null;
  function pumpSoon() {
    if (pumpT) clearTimeout(pumpT);
    pumpT = setTimeout(pump, waiting.size ? PUMP_BUSY : PUMP_IDLE);
  }
  function pump() {
    pumpT = null;
    if (!api) return;
    try {
      api.frame(pipe);
      const msg = {};
      while (api.next(pipe, msg)) {
        try {
          if (msg.cb === CB_DONE && msg.param) {
            const d = koffi.decode(msg.param, Done), w = waiting.get(String(d.call));
            if (w) {
              waiting.delete(String(d.call));
              const buf = Buffer.alloc(Math.max(w.size, d.cub)), failed = [false];
              const got = d.cb === w.cb && api.result(pipe, d.call, buf, buf.length, w.cb, failed) && !failed[0];
              w.done(got ? buf : null);
            }
          }
        } finally { api.free(pipe); }
      }
    } catch (e) { log('board pump FAILED: ' + e.message); }
    const now = Date.now();
    for (const [id, w] of waiting) if (now - w.at > WAIT_MAX) { waiting.delete(id); w.done(null); }
    pumpSoon();
  }
  // one asynchronous call: its result struct's bytes, or null when it failed
  function call(id, cb, size) {
    return new Promise((done) => {
      if (!id || id === 0n || id === 0) { done(null); return; } // k_uAPICallInvalid: Steam refused at once
      waiting.set(String(id), { cb, size, done, at: Date.now() });
      pumpSoon();
    });
  }
  if (api) pumpSoon();

  // the board's handle, found (or made, the first time anyone posts) once
  let board = null, finding = null;
  function findBoard() {
    if (board) return Promise.resolve(board);
    if (!finding) {
      finding = call(api.find(stats, BOARD_NAME, SORT_DESC, SHOW_NUMBER), CB_FIND, AT.find).then((buf) => {
        finding = null;
        if (!buf || !buf[AT.found]) { log('board find FAILED'); return null; }
        board = buf.readBigUInt64LE(0);
        return board;
      });
    }
    return finding;
  }
  const whole = (n, lo, hi) => typeof n === 'number' && isFinite(n) && n >= lo && n <= hi;

  // POST: this player's rating, with their card packed into the details
  S.post = async (score, details) => {
    if (!api) return { ok: false, error: S.error };
    if (!whole(score, 0, SCORE_MAX) || !Array.isArray(details) || details.length > DETAILS_MAX || !details.every((n) => whole(n, -2147483648, 4294967295))) return { ok: false, error: 'bad post' };
    const h = await findBoard();
    if (!h) return { ok: false, error: 'no board' };
    const d = Buffer.alloc(4 * Math.max(1, details.length));
    details.forEach((n, i) => d.writeInt32LE(n | 0, 4 * i));
    const buf = await call(api.upload(stats, h, POST_FORCE, Math.floor(score), d, details.length), CB_UP, AT.up);
    if (!buf || !buf[AT.upOk]) { log('board post FAILED'); return { ok: false, error: 'post refused' }; }
    return { ok: true, rank: buf.readInt32LE(AT.rankNew), was: buf.readInt32LE(AT.rankOld) };
  };
  // READ: the top `top` rows and the `around` either side of this player,
  // each { id: SteamID, rank, score, details }, by rank, once each
  function rows(entries, n) {
    const out = [], e = Buffer.alloc(AT.entry), d = Buffer.alloc(4 * DETAILS_MAX);
    for (let i = 0; i < n; i++) {
      e.fill(0);
      if (!api.entry(stats, entries, i, e, d, DETAILS_MAX)) continue;
      const k = Math.max(0, Math.min(DETAILS_MAX, e.readInt32LE(AT.eDetails))), details = [];
      for (let j = 0; j < k; j++) details.push(d.readInt32LE(4 * j));
      out.push({ id: e.readBigUInt64LE(0).toString(), rank: e.readInt32LE(AT.eRank), score: e.readInt32LE(AT.eScore), details });
    }
    return out;
  }
  async function download(h, ask, from, to) {
    const buf = await call(api.download(stats, h, ask, from, to), CB_DOWN, AT.down);
    if (!buf) return null;
    return rows(buf.readBigUInt64LE(AT.entries), Math.max(0, buf.readInt32LE(AT.count)));
  }
  S.read = async (top, around) => {
    if (!api) return { ok: false, error: S.error };
    top = whole(top, 0, ROWS_MAX) ? Math.floor(top) : 0;
    around = whole(around, 0, ROWS_MAX >> 1) ? Math.floor(around) : 0;
    const h = await findBoard();
    if (!h) return { ok: false, error: 'no board' };
    const [a, b] = await Promise.all([top ? download(h, ASK_GLOBAL, 1, top) : [], around ? download(h, ASK_AROUND, -around, around) : []]);
    if (!a || !b) { log('board read FAILED'); return { ok: false, error: 'read failed' }; }
    const by = new Map();
    for (const r of a.concat(b)) by.set(r.id, r);
    return { ok: true, total: api.count(stats, h), rows: [...by.values()].sort((x, y) => x.rank - y.rank) };
  };
  // the pipe goes back to Steam with the app
  S.close = () => {
    if (!api) return;
    if (pumpT) clearTimeout(pumpT);
    for (const w of waiting.values()) w.done(null);
    waiting.clear();
    try { api.dropUser(client, pipe, user); api.dropPipe(client, pipe); } catch (e) { }
    api = null; S.ok = false;
  };
  return S;
}

module.exports = { steamBoard };
