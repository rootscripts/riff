const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  onWindowVisibility: (callback) => {
    ipcRenderer.on('window-visibility', (event, visible) => callback(visible));
  },
  setZoomFactor: (factor) => {
    try {
      webFrame.setZoomFactor(factor);
    } catch (e) {}
  },
  getZoomFactor: () => {
    try {
      return webFrame.getZoomFactor();
    } catch (e) {
      return 1.0;
    }
  },

  discordRpcUpdate: (trackInfo) => ipcRenderer.send('discord-rpc-update', trackInfo),
  discordRpcClear: () => ipcRenderer.send('discord-rpc-clear'),
  discordRpcSetEnabled: (enabled) => ipcRenderer.send('discord-rpc-set-enabled', enabled),
  discordRpcGetEnabled: () => ipcRenderer.invoke('discord-rpc-get-enabled'),
  discordRpcGetConnected: () => ipcRenderer.invoke('discord-rpc-get-connected'),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  updateAction: (action) => ipcRenderer.send('update-action', action),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (e, d) => cb(d)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (e, d) => cb(d)),
  onUpdateReady: (cb) => ipcRenderer.on('update-ready', (e, d) => cb(d)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (e, d) => cb(d)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (e, d) => cb(d)),
});
