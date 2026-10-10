const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filename, data, type) => 
    ipcRenderer.invoke('save-file', { filename, data, type }),
  openExternal: (url) => 
    ipcRenderer.invoke('open-external', { url }),
  getVersion: () => 
    ipcRenderer.invoke('get-version'),
  storeToken: (token) => 
    ipcRenderer.invoke('store-token', token),
  getToken: () => 
    ipcRenderer.invoke('get-token'),
  clearToken: () => 
    ipcRenderer.invoke('clear-token'),
  storeData: (key, val) => 
    ipcRenderer.invoke('store-data', key, val),
  getData: (key) => 
    ipcRenderer.invoke('get-data', key),
  onLogoutTriggered: (callback) => {
    ipcRenderer.removeAllListeners('logout-triggered');
    ipcRenderer.on('logout-triggered', callback);
  }
});
