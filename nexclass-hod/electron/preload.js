const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  storeToken: (t) => ipcRenderer.invoke('store-token', t),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  saveFile: (filename, data, type) =>
    ipcRenderer.invoke('save-file', { filename, data, type }),
})

