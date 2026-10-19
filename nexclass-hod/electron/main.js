const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const Store = require('electron-store')

const isDev = !app.isPackaged
const devUrl = 'http://localhost:5176'
const appHtmlPath = path.resolve(__dirname, '../dist/index.html')
const appFileUrl = pathToFileURL(appHtmlPath).href
let mainWindow = null
let serverInfo = null
let closeServer = null

app.setPath('sessionData', path.join(app.getPath('temp'), 'nexclass-hod-session'))

const store = new Store()

function buildApplicationMenu() {
  const mainMenu = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Logout',
          accelerator: 'CmdOrCtrl+L',
          click: async () => {
            store.delete('token')
            if (mainWindow && !mainWindow.isDestroyed()) {
              await mainWindow.webContents.executeJavaScript('localStorage.removeItem("nexclass_token")')
              mainWindow.webContents.reload()
            }
          },
        },
        { type: 'separator' },
        { label: 'Quit NexClass HOD', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        {
          label: 'Zoom In', accelerator: 'CmdOrCtrl+=',
          click: () => {
            if (mainWindow) mainWindow.webContents.setZoomFactor(mainWindow.webContents.getZoomFactor() + 0.1)
          },
        },
        {
          label: 'Zoom Out', accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (!mainWindow) return
            mainWindow.webContents.setZoomFactor(Math.max(0.5, mainWindow.webContents.getZoomFactor() - 0.1))
          },
        },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.setZoomFactor(1) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About NexClass HOD',
          click: () => {
            if (!mainWindow) return
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About NexClass HOD Portal',
              message: 'NexClass HOD Portal',
              detail: 'Version 1.0.0\nDepartment monitoring platform\nBuilt for Bangalore Institute of Technology\n\n© 2025 NexClass. All rights reserved.',
              buttons: ['OK'],
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenu))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1100, minHeight: 700,
    title: 'NexClass HOD Portal',
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  })

  mainWindow.setTitle('NexClass HOD Portal')
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false
    try {
      if (isDev) allowed = new URL(url).origin === devUrl
      else allowed = url.startsWith(appFileUrl)
    } catch {
      allowed = false
    }
    if (!allowed) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.on('closed', () => { mainWindow = null })

  if (isDev) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(appHtmlPath)
}

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('get-server-info', () => serverInfo ? { ip: serverInfo.ip, port: serverInfo.port } : null)
ipcMain.handle('store-token', (_event, token) => store.set('token', token))
ipcMain.handle('get-token', () => store.get('token'))
ipcMain.handle('clear-token', () => store.delete('token'))
ipcMain.handle('save-file', async (_event, { filename, data, type }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: filename })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, data)
  return true
})

app.whenReady().then(async () => {
  try {
    // Load after Electron is ready so the database can use app.getPath('userData').
    const { startServer } = require('../server/index')
    serverInfo = await startServer()
    closeServer = serverInfo.close
  } catch (error) {
    console.error('Failed to start NexClass HOD server:', error)
    dialog.showErrorBox('Server startup failed', `The local department server could not start.\n\n${error.message}`)
  }
  buildApplicationMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  if (closeServer) {
    const close = closeServer
    closeServer = null
    close().catch((error) => console.error('Server shutdown error:', error))
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

