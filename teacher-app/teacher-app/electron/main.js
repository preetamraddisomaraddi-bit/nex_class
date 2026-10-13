const { app, BrowserWindow, ipcMain, desktopCapturer, screen, session, protocol, net } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');

const isDev = !app.isPackaged;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    title: 'NexClass — Teacher Dashboard',
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
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());
}

// Screen capture for screen sharing
ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// PDF push picker
ipcMain.handle('select-pdf', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');
  const result = await dialog.showOpenDialog({
    title: 'Select PDF to Push',
    filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  return {
    filename: path.basename(filePath),
    filedata: buffer.toString('base64')
  };
});

// Local presentation file picker
ipcMain.handle('select-presenter-file', async () => {
  const { dialog } = require('electron');
  const path = require('path');
  const result = await dialog.showOpenDialog({
    title: 'Select Presentation File',
    filters: [{ name: 'Classroom Presentations', extensions: ['pdf', 'ppt', 'pptx', 'mp4', 'mkv', 'avi', 'mov'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  
  return {
    filePath,
    filename: path.basename(filePath),
    ext
  };
});

// Read local file binary buffer as base64
ipcMain.handle('read-file-buffer', async (event, filePath) => {
  const fs = require('fs');
  try {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  } catch (err) {
    console.error('[IPC] Error reading file buffer:', err);
    return null;
  }
});

// Headless LibreOffice PPT/PPTX to PDF converter
ipcMain.handle('convert-ppt-to-pdf', async (event, filePath) => {
  const { exec } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  let sofficePath = 'soffice';
  if (process.platform === 'win32') {
    const commonWinPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];
    for (const p of commonWinPaths) {
      if (fs.existsSync(p)) {
        sofficePath = `"${p}"`;
        break;
      }
    }
  }
  
  const checkCommand = process.platform === 'win32' && sofficePath === 'soffice' ? 'where soffice' : `${sofficePath} --version`;
  const isLibreOfficeInstalled = await new Promise((resolve) => {
    exec(checkCommand, (err) => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
  
  if (!isLibreOfficeInstalled) {
    return { error: 'LibreOffice is not installed. Please download it from https://www.libreoffice.org/' };
  }
  
  const tempDir = os.tmpdir();
  const command = `${sofficePath} --headless --convert-to pdf --outdir "${tempDir}" "${filePath}"`;
  
  return new Promise((resolve) => {
    exec(command, (err) => {
      if (err) {
        console.error('[IPC] LibreOffice conversion error:', err);
        return resolve({ error: 'Failed to convert PPT to PDF: ' + err.message });
      }
      
      const baseName = path.basename(filePath, path.extname(filePath));
      const pdfPath = path.join(tempDir, `${baseName}.pdf`);
      
      if (fs.existsSync(pdfPath)) {
        const pdfBuffer = fs.readFileSync(pdfPath);
        try { fs.unlinkSync(pdfPath); } catch (e) {}
        resolve({ pdfData: pdfBuffer.toString('base64') });
      } else {
        resolve({ error: 'Converted PDF file not found.' });
      }
    });
  });
});

app.whenReady().then(() => {
  // Register local-media protocol to securely stream local video files
  protocol.handle('local-media', (request) => {
    const urlPath = request.url.replace('local-media://', '');
    return net.fetch('file://' + decodeURIComponent(urlPath));
  });

  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) app.whenReady().then(createWindow); });
