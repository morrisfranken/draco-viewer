const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { mtllibRefs, mtlTextureRefs, resolveRef } = require('./web/obj-refs.js');
const { gvfsSftpTarget, SshFileSource } = require('./ssh-source.js');

const DIST = path.join(__dirname, 'dist');
const EXTENSIONS = ['.drc', '.glb', '.obj'];

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
  if (path.extname(filePath).toLowerCase() === '.obj') return readObj(filePath);
  return { name: path.basename(filePath), path: filePath, data: await fs.promises.readFile(filePath) };
}

/** Read a file, retrying with a case-insensitive name match (files authored on Windows). */
async function readAsset(dir, ref) {
  const file = path.join(dir, ...ref.split('/'));
  try {
    return await fs.promises.readFile(file);
  } catch {
    try {
      const base = path.basename(file).toLowerCase();
      const match = (await fs.promises.readdir(path.dirname(file))).find((f) => f.toLowerCase() === base);
      return match ? await fs.promises.readFile(path.join(path.dirname(file), match)) : null;
    } catch {
      return null;
    }
  }
}

async function readHead(filePath, bytes) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(bytes), 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString('latin1');
  } finally {
    await handle.close();
  }
}

async function readObj(filePath) {
  const remote = process.env.DRACO_VIEWER_NO_SSH ? null : gvfsSftpTarget(filePath);
  if (remote) {
    try {
      return await readObjOverSsh(filePath, remote);
    } catch (err) {
      console.warn(`SSH read failed, using the mount instead: ${err.message}`);
    }
  }
  return readObjFromDisk(filePath);
}

// On a gvfs sftp mount: one compressed SSH session (see ssh-source.js). Requests are
// answered in order over a single pipe, so this costs a connection and two round trips.
async function readObjOverSsh(filePath, remote) {
  const ssh = new SshFileSource(remote);
  try {
    const dir = path.dirname(filePath);
    const remoteDir = path.posix.dirname(remote.path);
    const HEAD = 64 * 1024;
    const head = await ssh.get('head', remote.path, HEAD);
    if (!head) throw new Error(`cannot read ${remote.path}`);
    const rest = head.length < HEAD ? Promise.resolve(Buffer.alloc(0)) : null;
    const libs = mtllibRefs(head.toString('latin1'));
    // Asset refs are relative to the OBJ; fall back to the mount per file (e.g. names that
    // only match case-insensitively).
    const fetchAsset = async (ref) => (await ssh.get('cat', path.posix.join(remoteDir, ref))) ?? readAsset(dir, ref);
    const mtls = libs.map((lib) => fetchAsset(lib));
    const tail = rest ?? ssh.get('tail', remote.path, HEAD);
    const assets = [];
    const missing = [];
    const textureReads = [];
    for (const [i, lib] of libs.entries()) {
      const mtl = await mtls[i];
      if (!mtl) { missing.push(lib); continue; }
      assets.push({ ref: lib, data: mtl });
      for (const map of mtlTextureRefs(mtl.toString('utf8'))) {
        const ref = resolveRef(lib, map);
        textureReads.push(fetchAsset(ref).then((data) => (data ? assets.push({ ref, data }) : missing.push(ref))));
      }
    }
    const data = Buffer.concat([head, await tail]);
    await Promise.all(textureReads);
    // mtllib beyond the first 64 KB is rare; the renderer will then report it as missing.
    if (!libs.length && mtllibRefs(data.toString('latin1')).length) return readObjFromDisk(filePath);
    return { name: path.basename(filePath), path: filePath, data, assets, missing, transport: 'ssh' };
  } finally {
    ssh.close();
  }
}

// An OBJ comes with an MTL file and textures. On network mounts (sftp, smb) each file
// costs round trips, so rather than reading them one after another, the MTL and textures
// are read while the (large) OBJ itself is still loading, all as whole-file reads.
async function readObjFromDisk(filePath) {
  const dir = path.dirname(filePath);
  const objData = fs.promises.readFile(filePath);
  let libs = mtllibRefs(await readHead(filePath, 64 * 1024));
  if (!libs.length) libs = mtllibRefs((await objData).toString('latin1')); // mtllib further down
  const assets = [];
  const missing = [];
  await Promise.all(libs.map(async (lib) => {
    const mtl = await readAsset(dir, lib);
    if (!mtl) return missing.push(lib);
    assets.push({ ref: lib, data: mtl });
    await Promise.all(mtlTextureRefs(mtl.toString('utf8')).map(async (map) => {
      const ref = resolveRef(lib, map);
      const data = await readAsset(dir, ref);
      if (data) assets.push({ ref, data });
      else missing.push(ref);
    }));
  }));
  return { name: path.basename(filePath), path: filePath, data: await objData, assets, missing };
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

// Files opened from inside the window (drag & drop, file picker) by path.
ipcMain.handle('read-files', (_event, paths) => readModels(paths.filter((p) => EXTENSIONS.includes(path.extname(p).toLowerCase()))));

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
