// The one object the page may see of Steam: `window.steamBridge`. Every call
// is a promise answered by main.js; the two subscriptions hand the page the
// lobby events and the packets the pump read (each { from, text } or { from, bin }). Nothing here is the game's -
// js/net/transport-steam.js is the adapter that speaks this to NET.
const { contextBridge, ipcRenderer } = require('electron');

// this page holds no lobby yet: the one before it may have (main.js, steam:fresh)
ipcRenderer.invoke('steam:fresh');

contextBridge.exposeInMainWorld('steamBridge', {
  info: () => ipcRenderer.invoke('steam:info'),
  createLobby: (kind, max) => ipcRenderer.invoke('steam:createLobby', kind, max),
  joinLobby: (id) => ipcRenderer.invoke('steam:joinLobby', String(id)),
  leaveLobby: (id) => ipcRenderer.invoke('steam:leaveLobby', String(id)),
  lobby: (id) => ipcRenderer.invoke('steam:lobby', String(id)),
  lobbies: (ask) => ipcRenderer.invoke('steam:lobbies', ask), // ask: { patch, seek, near } narrows Steam's list (steam-friends.js, lobbyFilter)
  pingLoc: () => ipcRenderer.invoke('steam:pingLoc'), // this machine's ping location as text ('' until Steam has one; steam-messages.js)
  pingTo: (loc) => ipcRenderer.invoke('steam:pingTo', String(loc)), // ms to another machine's location, -1 when it cannot be told
  setLobbyData: (id, data) => ipcRenderer.invoke('steam:setLobbyData', String(id), data),
  invite: (id) => ipcRenderer.invoke('steam:invite', String(id)),
  log: (line) => ipcRenderer.invoke('steam:log', String(line)), // a line into softfall-steam.log beside the exe
  quit: () => ipcRenderer.invoke('win:quit'), // the title's QUIT: the app closes, Steam's "playing" with it (js/ui/menu.js)
  flash: () => ipcRenderer.invoke('win:flash'), // the taskbar button blinks until the window is looked at (js/ui/roomtalk.js)
  // the VIDEO page's DISPLAY row (setFullscreen, js/app/canvas.js); main.js remembers it between launches
  fullscreen: (on) => ipcRenderer.invoke('win:fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  onFullscreen: (cb) => ipcRenderer.on('win:fullscreen', (e, on) => cb(!!on)),
  // Steam Cloud: one small text file by name, '' none yet, null no cloud (PROFILE.cloudSync, js/app/profile.js)
  cloudRead: (name) => ipcRenderer.invoke('cloud:read', String(name)),
  cloudWrite: (name, text) => ipcRenderer.invoke('cloud:write', String(name), String(text)),
  send: (to, data, reliable) => ipcRenderer.invoke('steam:send', String(to), data, reliable), // data: a string, or a Uint8Array sent as bytes
  accept: (id) => ipcRenderer.invoke('steam:accept', String(id)),
  // the friends panel (js/ui/friends.js, desktop/steam-friends.js)
  friends: () => ipcRenderer.invoke('steam:friends'), // { ok, friends: [{ id, name, st, game, lobby?, mode?, n?, state?, patch?, hero? }], recent: [{ id, name, st }] }
  inviteFriend: (lobby, id, card) => ipcRenderer.invoke('steam:inviteFriend', String(lobby), String(id), card), // card: { mode, n, patch }, shown on their screen
  overlayUser: (dialog, id) => ipcRenderer.invoke('steam:overlayUser', String(dialog), String(id)), // 'friendadd' | 'steamid' | 'chat'
  overlayFriends: () => ipcRenderer.invoke('steam:overlayFriends'),
  presence: (kv) => ipcRenderer.invoke('steam:presence', kv), // rich presence: status, connect, sf_*
  playedWith: (lobby) => ipcRenderer.invoke('steam:playedWith', String(lobby)),
  onEvent: (cb) => ipcRenderer.on('steam:event', (e, ev) => cb(ev)),
  onPackets: (cb) => ipcRenderer.on('steam:packets', (e, list) => cb(list)),
});
