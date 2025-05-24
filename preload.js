const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadFile: (callback) => ipcRenderer.on('load-file', (_event, filePath) => callback(filePath)),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  removeAllLoadFileListeners: () => ipcRenderer.removeAllListeners('load-file')
});
