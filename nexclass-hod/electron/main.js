const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { fork } = require('child_process')
const { pathToFileURL } = require('url')
const Store = require('electron-store')

const isDev = !app.isPackaged
const devUrl = 'http://localhost:5175'
const appHtmlPath = path.resolve(__dirname, '../dist/index.html')
const appFileUrl = pathToFileURL(appHtmlPath).href
let mainWindow = null
let serverInfo = null
let serverChild = null
let restartCount = 0
let restartResetTimer = null
let shuttingDown = false
let quitAfterServer = false

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
ipcMain.handle('get-server-info', () => serverInfo ? { ip: serverInfo.ip, ips: serverInfo.ips, port: serverInfo.port, protocol: serverInfo.protocol } : null)
ipcMain.handle('store-token', (_event, token) => store.set('token', token))
ipcMain.handle('get-token', () => store.get('token'))
ipcMain.handle('clear-token', () => store.delete('token'))
ipcMain.handle('save-file', async (_event, { filename, data, type }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: filename })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, data)
  return true
})
ipcMain.handle('pick-license-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'Select NexClass license', properties: ['openFile'],
    filters: [{ name: 'NexClass License', extensions: ['nexlicense', 'json'] }],
  })
  if (canceled || !filePaths?.[0]) return null
  return { filePath: filePaths[0], content: fs.readFileSync(filePaths[0], 'utf8') }
})

const serverCliPath = path.join(__dirname, '../server/cli.js')
const serverDataPath = path.join(app.getPath('userData'), 'server-data')
const serverPort = Number(process.env.PORT || 3000)

function prepareServerData() {
  fs.mkdirSync(serverDataPath, { recursive: true })
  const newDb = path.join(serverDataPath, 'nexclass-hod.db')
  const oldDb = path.join(app.getPath('userData'), 'nexclass-hod.db')
  if (!fs.existsSync(newDb) && fs.existsSync(oldDb)) {
    for (const suffix of ['', '-wal', '-shm']) {
      const from = `${oldDb}${suffix}`
      if (fs.existsSync(from)) fs.copyFileSync(from, `${newDb}${suffix}`)
    }
  }
  const newSecret = path.join(serverDataPath, 'secret.key')
  if (!fs.existsSync(newSecret)) {
    for (const filename of ['secret.key', 'nexclass-jwt-secret']) {
      const oldSecret = path.join(app.getPath('userData'), filename)
      if (fs.existsSync(oldSecret)) { fs.copyFileSync(oldSecret, newSecret); break }
    }
  }
}

function launchServer() {
  return new Promise((resolve, reject) => {
    const child = fork(serverCliPath, [], {
      execPath: process.execPath,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DATA_DIR: serverDataPath,
        PORT: String(serverPort),
        NODE_PATH: isDev ? path.join(__dirname, '../server/node_modules') : path.join(process.resourcesPath, 'server-node-modules'),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      serialization: 'json',
    })
    serverChild = child
    let settled = false
    let ready = false
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; child.kill('SIGTERM'); reject(new Error('Timed out waiting for the NexClass server to become ready.')) }
    }, 30000)
    child.stdout?.on('data', chunk => console.log(`[NexClass server] ${chunk.toString().trimEnd()}`))
    child.stderr?.on('data', chunk => console.error(`[NexClass server] ${chunk.toString().trimEnd()}`))
    child.on('message', message => {
      if (message?.type === 'ready' && !settled) {
        settled = true
        ready = true
        clearTimeout(timeout)
        serverInfo = { ip: message.ip, ips: message.ips || [message.ip], port: message.port, protocol: message.protocol || 'http' }
        resolve(serverInfo)
      } else if (message?.type === 'error' && !settled) {
        settled = true
        clearTimeout(timeout)
        const error = new Error(message.message || 'NexClass server failed to start.')
        error.code = message.code
        reject(error)
      }
    })
    child.once('error', error => {
      if (!settled) { settled = true; clearTimeout(timeout); reject(error) }
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (serverChild === child) serverChild = null
      if (restartResetTimer) { clearTimeout(restartResetTimer); restartResetTimer = null }
      if (!settled) {
        settled = true
        reject(new Error(`NexClass server exited before readiness (code ${code ?? 'none'}, signal ${signal || 'none'}).`))
      } else if (ready && !shuttingDown && !quitAfterServer) {
        serverInfo = null
        scheduleServerRestart()
      }
    })
  })
}

function showServerRecovery(message) {
  if (shuttingDown || !mainWindow) return
  dialog.showMessageBox(mainWindow, {
    type: 'error', title: 'NexClass server stopped', message: 'NexClass server stopped',
    detail: message, buttons: ['Retry', 'Quit'], defaultId: 0, cancelId: 1,
  }).then(({ response }) => {
    if (response === 0) { restartCount = 0; launchServer().catch(error => showServerRecovery(error.message)) }
    else app.quit()
  })
}

function scheduleServerRestart() {
  if (shuttingDown) return
  if (restartCount >= 5) {
    showServerRecovery('The local server exited repeatedly. Retry to start it again, or quit NexClass.')
    return
  }
  restartCount += 1
  setTimeout(() => {
    if (shuttingDown) return
    launchServer().then(() => {
      restartResetTimer = setTimeout(() => { restartCount = 0; restartResetTimer = null }, 60000)
      restartResetTimer.unref?.()
    }).catch(error => {
      if (error.code === 'EADDRINUSE') showServerRecovery(`Port ${serverPort} is already in use. Close the other NexClass server or choose a different PORT, then retry.`)
      else scheduleServerRestart()
    })
  }, 2000)
}

async function stopServerChild() {
  if (!serverChild || serverChild.killed) return
  const child = serverChild
  quitAfterServer = true
  child.kill('SIGTERM')
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(() => { child.kill('SIGKILL'); resolve() }, 9000)),
  ])
  serverChild = null
}

app.whenReady().then(async () => {
  buildApplicationMenu()
  createWindow()
  try { prepareServerData(); await launchServer() } catch (error) {
    console.error('Failed to start NexClass HOD server:', error)
    if (error.code === 'EADDRINUSE') showServerRecovery(`Port ${serverPort} is already in use by another process. Close the other NexClass server or configure a free PORT.`)
    else scheduleServerRestart()
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', event => {
  if (!serverChild || quitAfterServer) return
  event.preventDefault()
  shuttingDown = true
  stopServerChild().finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

