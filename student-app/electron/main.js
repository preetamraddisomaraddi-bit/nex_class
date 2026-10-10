const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

const isDev = process.env.NODE_ENV !== 'production';
let win = null;
let isFocusModeActive = false;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    minWidth: 1024,
    minHeight: 700,
    title: 'NexClass — Student Classroom',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 36,
    },
    backgroundColor: '#0f172a',
    show: false,
  });

  if (isDev) {
    win.loadURL('http://localhost:5174');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // Intercept close events to enforce Focus Mode lock
  win.on('close', (e) => {
    if (isFocusModeActive) {
      e.preventDefault();
      const { dialog } = require('electron');
      const choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        buttons: ['Stay in Class', 'Leave Class & Notify Teacher'],
        defaultId: 0,
        title: 'NexClass Focus Mode Lock',
        message: 'Leaving class will notify your teacher.',
        detail: 'Are you sure you want to force-leave the session?'
      });

      if (choice === 1) {
        // Send notification to renderer to emit socket force-close warning
        win.webContents.send('focus-mode-force-closed');
        isFocusModeActive = false;
        globalShortcut.unregisterAll();
        if (win) win.setKiosk(false);
        // Allow a small delay for the socket message to deliver, then close
        setTimeout(() => {
          if (win) win.destroy();
        }, 500);
      }
    }
  });
}

// Focus Mode IPC Handlers
ipcMain.on('enter-focus-mode', () => {
  isFocusModeActive = true;
  if (win) {
    win.setKiosk(true);
    // Block typical OS window switching shortcuts safely
    const shortcuts = ['Alt+Tab', 'Meta', 'Super', 'Ctrl+Escape', 'Alt+F4'];
    shortcuts.forEach(shortcut => {
      try {
        globalShortcut.register(shortcut, () => {
          console.log(`[Security] Blocked key combo inside Kiosk mode: ${shortcut}`);
        });
      } catch (err) {
        console.warn(`[Security] Could not register shortcut ${shortcut}:`, err.message);
      }
    });
  }
});

ipcMain.on('exit-focus-mode', () => {
  isFocusModeActive = false;
  if (win) {
    win.setKiosk(false);
  }
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    console.warn('[Security] Could not unregister shortcuts:', err.message);
  }
});

// PDF Save Dialog handler
ipcMain.handle('save-pdf', async (event, { filename, filedata }) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const result = await dialog.showSaveDialog(win, {
    title: 'Save PDF Document',
    defaultPath: filename,
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
  });
  
  if (result.canceled || !result.filePath) return false;
  
  try {
    const buffer = Buffer.from(filedata, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return true;
  } catch (err) {
    console.error('[IPC] Save PDF error:', err);
    return false;
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
