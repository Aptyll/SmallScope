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
//
// APP_ID is Valve's Spacewar (480), the App ID every Steam developer may use
// for testing lobbies and networking; a shipped build reads its own from
// steam_appid.txt beside the exe. Steam must be running and signed in, or
// init fails and the bridge reports `ready: false` - the page then plays solo.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = (() => {
  try { return parseInt(fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8'), 10) || 480; } catch (e) { return 480; }
})();
let steam = null, steamErr = null;
try {
  const steamworks = require('steamworks.js');
  steam = steamworks.init(APP_ID);
  steamworks.electronEnableSteamOverlay();
} catch (e) { steamErr = e.message; }

const args = {};
for (const a of process.argv.slice(1)) { const m = /^--(\w+)(?:=(.*))?$/.exec(a); if (m) args[m[1]] = m[2] === undefined ? '1' : m[2]; }

const lobbies = new Map(); // id (string) -> Lobby, the ones this process created or joined
let win = null;
const str = (v) => (typeof v === 'bigint' ? v.toString() : v);
const lobbyInfo = (l) => ({ id: str(l.id), owner: str(l.getOwner().steamId64), members: l.getMembers().map((m) => str(m.steamId64)), data: l.getFullData() });
const emit = (ev) => { if (win && !win.isDestroyed()) win.webContents.send('steam:event', ev); };

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#0f1632', title: 'Softfall',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, // a host keeps stepping while the window is behind another
    },
  });
  win.setMenuBarVisibility(false);
  const query = {};
  if (args.seed) query.seed = args.seed;
  if (args.net) query.net = args.net;
  if (args.join) { query.net = 'client'; query.lobby = args.join; }
  if (args.relay) query.relay = args.relay;           // the match relay (host:port); remembered by the page
  if (args.transport) query.transport = args.transport; // 'steam' to ride a Steam lobby instead of the relay
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
ipcMain.handle('steam:lobby', (e, id) => { const l = lobbies.get(String(id)); return l ? lobbyInfo(l) : null; });
ipcMain.handle('steam:lobbies', async () => (await steam.matchmaking.getLobbies()).map(lobbyInfo));
ipcMain.handle('steam:setLobbyData', (e, id, data) => { const l = lobbies.get(String(id)); return l ? l.mergeFullData(data) : false; });
ipcMain.handle('steam:invite', (e, id) => { const l = lobbies.get(String(id)); if (l) l.openInviteDialog(); return !!l; });
// text goes as utf8 on the RELIABLE channel: steamworks.js exposes Steam's
// older P2P sockets, whose reliable packet is capped at 1 MB and unreliable
// at 1200 bytes - the transport chunks above the first and the wire form
// (docs/pvp-architecture.md) is what makes the second usable
ipcMain.handle('steam:send', (e, to, text, reliable) => steam.networking.sendP2PPacket(BigInt(to), reliable === false ? 0 : 2, Buffer.from(text, 'utf8')));
ipcMain.handle('steam:accept', (e, id) => { steam.networking.acceptP2PSession(BigInt(id)); return true; });

// ---- the pump: packets and lobby events to the page ---------------------
function pump() {
  if (!steam || !win || win.isDestroyed()) return;
  const list = [];
  let n;
  while ((n = steam.networking.isP2PPacketAvailable()) > 0) {
    const pk = steam.networking.readP2PPacket(n);
    list.push({ from: str(pk.steamId.steamId64), text: pk.data.toString('utf8') });
    if (list.length >= 64) break;
  }
  if (list.length) win.webContents.send('steam:packets', list);
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
