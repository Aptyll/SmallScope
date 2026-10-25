// The Windows wrapper: one BrowserWindow around the same index.html a browser
// opens, and Steam behind a bridge (preload.js) the page reads as
// `window.steamBridge`. The game never touches Node - everything Steam is an
// IPC call answered here - and with no bridge (a browser, a double-click)
// the page runs solo exactly as before (docs/pvp-architecture.md).
//
//   npm start                      solo, the title as always
//   npm start -- --net=host        host a public lobby on the dev App ID
//   npm start -- --join=LOBBYID    join one (the seed comes from the lobby)
//   npm start -- --seed=N          pin the world, as ?seed=N does
//   npm start -- --transport=relay the relay's rooms instead of Steam's lobbies (the default while Steam is up)
//   npm start -- --windowed        a 1280x720 window instead of fullscreen
//
// APP_ID: the SteamAppId Steam puts in the environment of a build it launches,
// else steam_appid.txt beside this file (Softfall's own, 5244550, committed -
// the build copies it beside the exe; the depot script strips it from an
// upload), else Valve's Spacewar (480), the App ID every developer may test on.
// Steam must be running and signed in, or
// init fails and the bridge reports `ready: false` - the page then plays solo.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = (() => {
  // a build Steam launches gets its id in the environment; a run from the repo reads the file
  const env = parseInt(process.env.SteamAppId || process.env.SteamGameId || '', 10);
  if (env) return env;
  try { return parseInt(fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8'), 10) || 480; } catch (e) { return 480; }
})();
// softfall-steam.log beside the exe: a Steam launch has no console, so the
// resolved App ID, whether the API came up, and the transport's errors go here
const LOG = path.join(path.dirname(process.execPath), 'softfall-steam.log');
function slog(line) { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + line + '\n'); } catch (e) {} }
let steam = null, steamErr = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init(APP_ID);
  steamworks.electronEnableSteamOverlay();
} catch (e) { steamErr = e.message; }
slog('appId ' + APP_ID + ' (env SteamAppId=' + (process.env.SteamAppId || '') + ') init ' + (steam ? 'OK' : 'FAILED: ' + steamErr));
// the friends list and the direct invite, which steamworks.js lacks (steam-friends.js)
const friends = steam ? require('./steam-friends.js').steamFriends(APP_ID) : null;
if (steam) slog('friends ' + (friends.ok ? 'OK' : 'FAILED: ' + friends.error));
const myId = () => (steam ? str(steam.localplayer.getSteamId().steamId64) : null);

const args = {};
for (const a of process.argv.slice(1)) { const m = /^--(\w+)(?:=(.*))?$/.exec(a); if (m) args[m[1]] = m[2] === undefined ? '1' : m[2]; }
// a launch from a friend's Steam invite (or Join Game) names the lobby as `+connect_lobby ID`
const connectAt = process.argv.indexOf('+connect_lobby');
const connectLobby = connectAt >= 0 && /^\d+$/.test(process.argv[connectAt + 1] || '') ? process.argv[connectAt + 1] : null;

const lobbies = new Map(); // id (string) -> Lobby, the ones this process created or joined
let win = null;
const str = (v) => (typeof v === 'bigint' ? v.toString() : v);
const lobbyInfo = (l) => ({ id: str(l.id), owner: str(l.getOwner().steamId64), members: l.getMembers().map((m) => str(m.steamId64)), data: l.getFullData() });
const emit = (ev) => { if (win && !win.isDestroyed()) win.webContents.send('steam:event', ev); };

function createWindow() {
  win = new BrowserWindow({
    // a game opens fullscreen, as a click on PLAY in Steam expects; F11 or
    // Alt+Enter toggles it, and leaving it gives the 1280x720 window
    width: 1280, height: 720, fullscreen: !args.windowed, backgroundColor: '#0f1632', title: 'Softfall',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, // a host keeps stepping while the window is behind another
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  // a window the page opens (F6, the Bot Lab) is this one's child, and the
  // app goes with this one: closing the game quits it (and Steam's "playing")
  // whatever else is still open. A web page (the title's KITCHEN tab) opens
  // in the player's own browser instead, never inside the game.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { parent: win, autoHideMenuBar: true, backgroundColor: '#0b0f16' } };
  });
  win.on('closed', () => { win = null; app.quit(); });
  win.on('focus', () => win.flashFrame(false)); // a nudge stops once the window is looked at
  const query = {};
  if (args.seed) query.seed = args.seed;
  if (args.net) query.net = args.net;
  if (args.join) { query.net = 'client'; query.lobby = args.join; }
  if (args.relay) query.relay = args.relay;           // the match relay (host:port); remembered by the page
  if (connectLobby && !args.join) query.join = connectLobby; // the page joins it from boot (JOIN_AT_BOOT, js/app/boot.js)
  // a launch with Steam up rides Steam's lobbies (Noah's ruling, 2026-10-14):
  // a player's own machine runs no relay. --transport=relay or a --relay=ADDR
  // keeps the relay; with Steam down the page plays solo or dials a relay
  if (args.transport) query.transport = args.transport;
  else if (steam && !args.relay) query.transport = 'steam';
  // packaged (build.js copies the game into app/), or run from the repo
  const page = fs.existsSync(path.join(__dirname, 'app', 'index.html')) ? path.join(__dirname, 'app', 'index.html') : path.join(__dirname, '..', 'index.html');
  win.loadFile(page, { query });
  if (args.devtools) win.webContents.openDevTools({ mode: 'detach' });
  // a headless check: --shot=PATH captures the window after --wait seconds,
  // prints the bridge and the page's net status, and --quit closes it
  if (args.shot) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(args.shot, img.toPNG());
        const status = await win.webContents.executeJavaScript('JSON.stringify({ net: window.DBG && DBG.netStatus(), mode: state.mode, seed: SEED, bridge: !!window.steamBridge, patch: PATCH_TXT })');
        console.log('shot ' + args.shot + ' ' + status + ' steam=' + (steam ? 'ready' : 'off:' + steamErr));
      } catch (e) { console.log('shot failed: ' + e.message); }
      if (args.quit) app.quit();
    }, (parseFloat(args.wait) || 3) * 1000));
  }
}

// ---- the bridge's answers -------------------------------------------------
ipcMain.handle('steam:info', () => ({
  ready: !!steam, error: steamErr, appId: APP_ID,
  id: steam ? str(steam.localplayer.getSteamId().steamId64) : null,
  name: steam ? steam.localplayer.getName() : null,
}));
ipcMain.handle('steam:createLobby', async (e, kind, max) => {
  const t = steam.matchmaking.LobbyType;
  const l = await steam.matchmaking.createLobby(kind === 'friends' ? 1 : kind === 'private' ? 0 : 2, max || 10);
  lobbies.set(str(l.id), l);
  return lobbyInfo(l);
});
ipcMain.handle('steam:joinLobby', async (e, id) => {
  let l = lobbies.get(String(id));
  if (!l) { l = await steam.matchmaking.joinLobby(BigInt(id)); lobbies.set(str(l.id), l); }
  return lobbyInfo(l);
});
ipcMain.handle('steam:leaveLobby', (e, id) => { const l = lobbies.get(String(id)); if (l) { l.leave(); lobbies.delete(String(id)); } return true; });
// a page starting (a boot, or a reload onto another seed, a rematch, a crossing)
// owns no lobby yet: whatever the page before it created or joined is left here,
// or it would linger on Steam's list with its old data - a party still looking
// (`seek`), a code a friend's lookup then finds instead of the live one
ipcMain.handle('steam:fresh', () => { for (const l of lobbies.values()) { try { l.leave(); } catch (err) { } } lobbies.clear(); return true; });
ipcMain.handle('steam:lobby', (e, id) => { const l = lobbies.get(String(id)); return l ? lobbyInfo(l) : null; });
// the whole world's lobbies, not only this region's (Steam's default): friends far apart still meet
ipcMain.handle('steam:lobbies', async () => { if (friends) friends.worldwide(); return (await steam.matchmaking.getLobbies()).map(lobbyInfo); });
ipcMain.handle('steam:setLobbyData', (e, id, data) => { const l = lobbies.get(String(id)); return l ? l.mergeFullData(data) : false; });
ipcMain.handle('steam:log', (e, line) => { slog(String(line).slice(0, 500)); return true; });
ipcMain.handle('win:flash', () => { if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true); return true; });
ipcMain.handle('steam:invite', (e, id) => { const l = lobbies.get(String(id)); if (l) l.openInviteDialog(); return !!l; });
// THE FRIENDS PANEL (js/ui/friends.js). friends() is the list; inviteFriend
// asks Steam to invite one friend to a lobby AND drops an INVITE_MAGIC packet
// on them, which their game shows as an in-game card (the pump below); the
// overlay calls open Steam's own pages, since a game cannot send a friend
// request itself; presence sets this player's rich presence (Steam's own
// friends list shows `status` and, through `connect`, Join Game); playedWith
// marks the lobby's other members as played with
const INVITE_MAGIC = 0xB2;
ipcMain.handle('steam:friends', () => (friends ? friends.list(myId()) : { ok: false, error: steamErr }));
ipcMain.handle('steam:inviteFriend', (e, lobby, id, card) => {
  if (!friends || !friends.ok) return false;
  const ok = friends.invite(lobby, id);
  const body = Buffer.from(JSON.stringify(Object.assign({}, card, { lobby: String(lobby) })).slice(0, 1000), 'utf8');
  steam.networking.sendP2PPacket(BigInt(id), 2, Buffer.concat([Buffer.from([INVITE_MAGIC]), body]));
  return ok;
});
ipcMain.handle('steam:overlayUser', (e, dialog, id) => (friends ? friends.overlayUser(String(dialog), String(id)) : false));
ipcMain.handle('steam:overlayFriends', () => (friends ? friends.overlay() : false));
ipcMain.handle('steam:presence', (e, kv) => (friends ? friends.presence(kv) : false));
ipcMain.handle('steam:playedWith', (e, lobby) => { const l = lobbies.get(String(lobby)); return friends && l ? friends.playedWith(l.getMembers().map((m) => str(m.steamId64)), myId()) : []; });
// text goes as utf8, bytes as they are; steamworks.js exposes Steam's older
// P2P sockets, whose reliable packet is capped at 1 MB and unreliable at
// 1200 bytes - the transport (js/net/transport-steam.js) chunks a message to
// fit whichever channel it asks for
ipcMain.handle('steam:send', (e, to, data, reliable) => steam.networking.sendP2PPacket(BigInt(to), reliable === false ? 0 : 2, typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)));
ipcMain.handle('steam:accept', (e, id) => { steam.networking.acceptP2PSession(BigInt(id)); return true; });

// ---- the pump: packets and lobby events to the page ---------------------
function pump() {
  if (!steam || !win || win.isDestroyed()) return;
  const list = [];
  let n;
  while ((n = steam.networking.isP2PPacketAvailable()) > 0) {
    const pk = steam.networking.readP2PPacket(n);
    if (pk.data[0] === INVITE_MAGIC) { invited(str(pk.steamId.steamId64), pk.data); continue; }
    // a binary frame (the transport's magic first byte) goes to the page as bytes, anything else as text
    list.push(pk.data[0] === 0xB1 ? { from: str(pk.steamId.steamId64), bin: new Uint8Array(pk.data) } : { from: str(pk.steamId.steamId64), text: pk.data.toString('utf8') });
    if (list.length >= 64) break;
  }
  if (list.length) win.webContents.send('steam:packets', list);
}
// a friend's invite packet: shown as a card in the game, from friends only
function invited(from, data) {
  if (!friends || !friends.isFriend(from)) return;
  let c; try { c = JSON.parse(data.subarray(1).toString('utf8')); } catch (e) { return; }
  if (!c || !/^\d+$/.test(String(c.lobby || ''))) return;
  emit({ t: 'invite', from, name: friends.nameOf(from), lobby: String(c.lobby), mode: String(c.mode || ''), n: c.n | 0, patch: String(c.patch || '') });
  if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true);
}
if (steam) {
  const CB = steam.callback.SteamCallback;
  steam.callback.register(CB.LobbyChatUpdate, (v) => emit({ t: 'chat', lobby: str(v.lobby), user: str(v.user_changed), change: v.member_state_change }));
  steam.callback.register(CB.LobbyDataUpdate, (v) => emit({ t: 'data', lobby: str(v.lobby), member: str(v.member), ok: v.success }));
  steam.callback.register(CB.P2PSessionRequest, (v) => { steam.networking.acceptP2PSession(v.remote); emit({ t: 'session', from: str(v.remote) }); });
  steam.callback.register(CB.P2PSessionConnectFail, (v) => emit({ t: 'sessionFail', from: str(v.remote), error: v.error }));
  steam.callback.register(CB.GameLobbyJoinRequested, (v) => emit({ t: 'joinRequested', lobby: str(v.lobby_steam_id), friend: str(v.friend_steam_id) }));
  setInterval(pump, 8);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
