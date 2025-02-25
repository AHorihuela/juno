const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', {
    invoke: (channel, ...args) => {
      // Whitelist channels that can be used
      const validChannels = [
        'memory:getStats',
        'memory:deleteItem',
        'memory:clearMemory',
        'context:getMemoryStats',
        'ai:getStats',
        'get-settings',
        'reset-settings',
        'get-selected-text-from-renderer'
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      
      return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
    },
    on: (channel, func) => {
      const validChannels = [
        'recording-status',
        'recording-error',
        'transcription',
        'transcription-history',
        'transcription-history-error'
      ];
      
      if (validChannels.includes(channel)) {
        // Strip event as it includes `sender` 
        const subscription = (event, ...args) => func(...args);
        ipcRenderer.on(channel, subscription);
        
        // Return a function to remove the listener
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    send: (channel, ...args) => {
      const validChannels = [
        'get-transcription-history',
        'delete-transcription',
        'clear-transcription-history'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    removeAllListeners: (channel) => {
      const validChannels = [
        'recording-status',
        'recording-error',
        'transcription',
        'transcription-history',
        'transcription-history-error',
        'error'
      ];
      
      if (validChannels.includes(channel)) {
        try {
          ipcRenderer.removeAllListeners(channel);
        } catch (error) {
          console.error(`Error removing listeners for channel ${channel}:`, error);
        }
      }
    }
  }
); 