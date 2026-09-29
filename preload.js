const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Files passed on the command line / via the file manager for this window.
  initialFiles: () => ipcRenderer.invoke('initial-files'),
  // Dropped / picked files are read by the main process, which also fetches OBJ textures.
  pathForFile: (file) => webUtils.getPathForFile(file),
  readFiles: (paths) => ipcRenderer.invoke('read-files', paths),
});
