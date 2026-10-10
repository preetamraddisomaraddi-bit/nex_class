const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  enterFocusMode: () => ipcRenderer.send('enter-focus-mode'),
  exitFocusMode: () => ipcRenderer.send('exit-focus-mode'),
  savePDF: (filename, filedata) => ipcRenderer.invoke('save-pdf', { filename, filedata }),
  onFocusModeForceClosed: (callback) => {
    ipcRenderer.on('focus-mode-force-closed', () => callback());
  }
});
