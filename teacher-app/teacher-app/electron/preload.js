const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  selectPDF: () => ipcRenderer.invoke('select-pdf'),
  selectPresenterFile: () => ipcRenderer.invoke('select-presenter-file'),
  readFileBuffer: (filePath) => ipcRenderer.invoke('read-file-buffer', filePath),
  convertPptToPdf: (filePath) => ipcRenderer.invoke('convert-ppt-to-pdf', filePath)
});
