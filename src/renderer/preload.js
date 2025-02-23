const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // ... existing methods ...
    
    // Add method for getting selected text
    getSelectedText: () => {
      return ipcRenderer.invoke('get-selected-text-from-renderer');
    }
  }
); 