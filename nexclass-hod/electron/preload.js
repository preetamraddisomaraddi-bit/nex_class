const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  storeToken: (t) => ipcRenderer.invoke('store-token', t),
  getToken: () => ipcRenderer.invoke('get-token'),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  saveFile: (filename, data, type) =>
    ipcRenderer.invoke('save-file', { filename, data, type }),
})
