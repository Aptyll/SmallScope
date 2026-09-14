// The one object the page may see of Steam: `window.steamBridge`. Every call
// is a promise answered by main.js; the two subscriptions hand the page the
// lobby events and the packets the pump read (each { from, text } or { from, bin }). Nothing here is the game's -
// js/net/transport-steam.js is the adapter that speaks this to NET.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steamBridge', {
  info: () => ipcRenderer.invoke('steam:info'),
  createLobby: (kind, max) => ipcRenderer.invoke('steam:createLobby', kind, max),
  joinLobby: (id) => ipcRenderer.invoke('steam:joinLobby', String(id)),
  leaveLobby: (id) => ipcRenderer.invoke('steam:leaveLobby', String(id)),
  lobby: (id) => ipcRenderer.invoke('steam:lobby', String(id)),
  lobbies: () => ipcRenderer.invoke('steam:lobbies'),
  setLobbyData: (id, data) => ipcRenderer.invoke('steam:setLobbyData', String(id), data),
  invite: (id) => ipcRenderer.invoke('steam:invite', String(id)),
  log: (line) => ipcRenderer.invoke('steam:log', String(line)), // a line into softfall-steam.log beside the exe
  send: (to, data, reliable) => ipcRenderer.invoke('steam:send', String(to), data, reliable), // data: a string, or a Uint8Array sent as bytes
  accept: (id) => ipcRenderer.invoke('steam:accept', String(id)),
  onEvent: (cb) => ipcRenderer.on('steam:event', (e, ev) => cb(ev)),
  onPackets: (cb) => ipcRenderer.on('steam:packets', (e, list) => cb(list)),
});
