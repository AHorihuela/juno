/**
 * Safe access to electron IPC renderer
 */
export const getIpcRenderer = () => {
  try {
    // Use the exposed electron API instead of requiring electron directly
    if (window.electron) {
      // Check if all required methods are available
      const hasRequiredMethods = 
        typeof window.electron.send === 'function' &&
        typeof window.electron.on === 'function' &&
        typeof window.electron.invoke === 'function';
      
      if (!hasRequiredMethods) {
        console.error('Electron IPC is missing required methods');
        return null;
      }
      
      return {
        send: window.electron.send,
        on: window.electron.on,
        invoke: window.electron.invoke,
        removeAllListeners: window.electron.removeAllListeners || function(channel) {
          console.warn(`removeAllListeners called for channel: ${channel}, but method not available`);
        }
      };
    }
    console.warn('Electron IPC not found in window object');
    return null;
  } catch (e) {
    console.error('Failed to load electron IPC, are we in a test environment?', e);
    return null;
  }
}; 