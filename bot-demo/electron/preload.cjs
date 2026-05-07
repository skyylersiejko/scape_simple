const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe API surface to the renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // Willow AI model file persistence — keeps the model in the app's userData folder
  // so it survives app reinstalls and can be copied to/from the web version.
  readModelFile: () => ipcRenderer.invoke('willow:read-model'),
  writeModelFile: (data) => ipcRenderer.invoke('willow:write-model', data),
});
