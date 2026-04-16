const { contextBridge } = require('electron');

// Expose a safe API surface to the renderer.
// Currently empty — add methods here if you later need Node.js features
// (e.g. file-system model export, native notifications).
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
