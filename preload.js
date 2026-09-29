const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Files passed on the command line / via the file manager for this window.
  initialFiles: () => ipcRenderer.invoke('initial-files'),
});
