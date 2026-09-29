const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const DIST = path.join(__dirname, 'dist');
const EXTENSIONS = ['.drc', '.glb'];

// Second launch (e.g. double-clicking another file) opens a window in the running
// process instead of starting a new Electron, which is much faster.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

function modelPaths(argv, cwd = process.cwd()) {
  return argv
    .filter((arg) => !arg.startsWith('-') && EXTENSIONS.includes(path.extname(arg).toLowerCase()))
    .map((arg) => path.resolve(cwd, arg.startsWith('file://') ? new URL(arg).pathname : arg));
}

async function readModel(filePath) {
  return { name: path.basename(filePath), path: filePath, data: await fs.promises.readFile(filePath) };
}

// Start reading files right away, in parallel with window creation.
function readModels(paths) {
  return Promise.allSettled(paths.map(readModel)).then((results) => ({
    files: results.filter((r) => r.status === 'fulfilled').map((r) => r.value),
    errors: results.filter((r) => r.status === 'rejected').map((r) => `Could not read file: ${r.reason.message}`),
  }));
}

const pendingFiles = new Map(); // webContents id -> Promise<{files, errors}>

function createWindow(paths) {
  const files = readModels(paths);
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#16181c',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  const id = win.webContents.id;
  pendingFiles.set(id, files);
  win.on('closed', () => pendingFiles.delete(id));

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.control && input.key.toLowerCase() === 'w') {
      win.close();
    }
  });

  win.loadFile(path.join(DIST, 'index.html'));
  return win;
}

ipcMain.handle('initial-files', (event) => {
  const files = pendingFiles.get(event.sender.id) || Promise.resolve({ files: [], errors: [] });
  pendingFiles.delete(event.sender.id); // release the buffers once handed over
  return files;
});

app.on('second-instance', (_event, argv, cwd) => {
  const paths = modelPaths(argv.slice(1), cwd);
  if (paths.length) createWindow(paths);
  else BrowserWindow.getAllWindows()[0]?.focus();
});

// macOS: files opened via Finder / dock.
const earlyOpenFiles = [];
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (app.isReady()) createWindow([filePath]);
  else earlyOpenFiles.push(filePath);
});

Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow([...modelPaths(process.argv.slice(1)), ...earlyOpenFiles]);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow([]);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
