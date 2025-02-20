/**
 * Safe access to electron IPC renderer
 */
export const getIpcRenderer = () => {
  try {
    return window.require('electron').ipcRenderer;
  } catch (e) {
    console.warn('Failed to load electron IPC, are we in a test environment?');
    return null;
  }
}; 