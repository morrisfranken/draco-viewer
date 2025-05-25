const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let filePathToLoad = null;

// Handle file path argument from command line
// process.argv contains command line arguments.
// For packaged apps, it might be different, but for `electron . file.drc`,
// it's usually process.argv[2] if electron is argv[0] and . is argv[1].
// If opened via protocol handler or .desktop file with %U, it might be different.
// We'll check for arguments that look like file paths.
const args = process.argv.slice(app.isPackaged ? 1 : 2); // Adjust slice depending on packaged or dev
console.log('Command line arguments:', args);

for (let arg of args) {
  // Skip arguments that look like flags
  if (arg.startsWith('--')) continue;
  
  // Try to resolve the path (in case it's relative)
  try {
    const resolvedPath = path.resolve(arg);
    console.log('Checking path:', resolvedPath);
    
    if (fs.existsSync(resolvedPath) && 
        (resolvedPath.toLowerCase().endsWith('.drc') || 
         resolvedPath.toLowerCase().endsWith('.glb'))) {
      filePathToLoad = resolvedPath;
      console.log('Found valid file to load:', filePathToLoad);
      break;
    }
  } catch (e) {
    console.error('Error resolving path:', arg, e);
  }
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // We'll create this for secure IPC
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false // Important for security, use preload script
    },
    icon: path.join(__dirname, 'drc-viewer.png') // Set window icon
  });

  mainWindow.loadFile('index.html');

  // DevTools can be enabled for debugging if needed
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send the file path to the renderer process if it was passed via command line
  mainWindow.webContents.on('did-finish-load', () => {
    if (filePathToLoad) {
      console.log('Main process: Sending file to load to renderer:', filePathToLoad);
      mainWindow.webContents.send('load-file', filePathToLoad);
      filePathToLoad = null; // Clear it after sending
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Listen for a request from the renderer to read a file's content
ipcMain.handle('read-file-content', async (event, filePath) => {
  console.log(`Main process: ipcMain.handle('read-file-content') called with path: ${filePath}`);
  try {
    // Make sure the path exists
    if (!fs.existsSync(filePath)) {
      console.error(`Main process: File does not exist: ${filePath}`);
      return { success: false, error: `File does not exist: ${filePath}` };
    }
    
    // Check if it's a readable file
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      console.error(`Main process: Path is not a file: ${filePath}`);
      return { success: false, error: `Path is not a file: ${filePath}` };
    }
    
    // Read the file
    console.log(`Main process: Reading file: ${filePath} (${stats.size} bytes)`);
    const buffer = fs.readFileSync(filePath);
    console.log(`Main process: Successfully read file '${filePath}', buffer length: ${buffer.length}`);
    
    return { success: true, data: buffer }; // fs.readFileSync returns a Buffer
  } catch (error) {
    console.error(`Main process: Error reading file content for '${filePath}':`, error);
    return { success: false, error: error.message };
  }
});

// Handle opening a file when the app is already running (e.g., macOS Dock or double-click)
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (mainWindow) {
    console.log('Main process: App already running, sending open-file to renderer:', path);
    mainWindow.webContents.send('load-file', path);
  } else {
    // App is not ready yet, store the path and load it once the window is created
    filePathToLoad = path;
  }
});
