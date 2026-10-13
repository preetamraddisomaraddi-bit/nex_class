const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

app.setPath('sessionData', path.join(app.getPath('temp'), 'nexclass-hod-session'))

const store = new Store()

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (!app.isPackaged) {
    window.loadURL('http://localhost:5176')
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('store-token', (_event, token) => store.set('token', token))
ipcMain.handle('get-token', () => store.get('token'))
ipcMain.handle('clear-token', () => store.delete('token'))
ipcMain.handle('save-file', async (_event, { filename, data, type }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: filename })
  if (canceled || !filePath) return false

  fs.writeFileSync(filePath, data)
  return true
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
