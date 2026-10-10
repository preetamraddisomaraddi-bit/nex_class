const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

Store.initRenderer();

let mainWindow;
const store = new Store();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5175');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Create App Menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Logout',
          click: () => {
            store.delete('token');
            store.delete('university');
            mainWindow.webContents.send('logout-triggered');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EduSync Admin',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About EduSync Admin',
              message: 'EduSync Administrative Portal',
              detail: `Version: ${app.getVersion()}\nManage departments, approve teachers, view analytics, and generate reports.`,
              type: 'info'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('save-file', async (event, { filename, data, type }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    buttonLabel: 'Save',
    filters: [
      { name: type === 'csv' ? 'CSV Files' : 'PDF Files', extensions: [type] }
    ]
  });

  if (filePath) {
    try {
      if (type === 'pdf') {
        const base64Data = data.split(';base64,').pop();
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      } else {
        fs.writeFileSync(filePath, data, 'utf-8');
      }
      return { success: true, path: filePath };
    } catch (err) {
      console.error('[IPC] save-file error:', err);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Cancelled' };
});

ipcMain.handle('open-external', async (event, { url }) => {
  await shell.openExternal(url);
  return { success: true };
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('store-token', (event, token) => {
  store.set('token', token);
  return true;
});

ipcMain.handle('get-token', () => {
  return store.get('token');
});

ipcMain.handle('clear-token', () => {
  store.delete('token');
  store.delete('university');
  return true;
});

ipcMain.handle('store-data', (event, key, val) => {
  store.set(key, val);
  return true;
});

ipcMain.handle('get-data', (event, key) => {
  return store.get(key);
});
