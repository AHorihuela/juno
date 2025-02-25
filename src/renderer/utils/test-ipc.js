/**
 * Test script for IPC communication
 * This file tests the IPC communication between renderer and main process
 */

import { getIpcRenderer } from './electron';

export const testIpcCommunication = () => {
  console.log('[Test] Starting IPC communication test...');
  
  try {
    // Check if window.electron exists
    if (!window.electron) {
      console.error('[Test] window.electron is not defined');
      return {
        success: false,
        error: 'window.electron is not defined',
        details: { windowElectronExists: false }
      };
    }
    
    // Log available methods on window.electron
    console.log('[Test] window.electron methods:', 
      Object.keys(window.electron).join(', '));
    
    const ipcRenderer = getIpcRenderer();
    console.log('[Test] IPC renderer object:', ipcRenderer);
    
    if (!ipcRenderer) {
      console.error('[Test] Failed to get ipcRenderer');
      return {
        success: false,
        error: 'Failed to get ipcRenderer',
        details: { 
          windowElectronExists: true,
          methods: Object.keys(window.electron)
        }
      };
    }
    
    console.log('[Test] Successfully got ipcRenderer with methods:', 
      Object.keys(ipcRenderer).join(', '));
    
    // Test if removeAllListeners exists
    const hasRemoveAllListeners = typeof ipcRenderer.removeAllListeners === 'function';
    console.log('[Test] removeAllListeners is a function:', hasRemoveAllListeners);
    
    // Test invoke
    let invokeSuccess = false;
    try {
      console.log('[Test] Testing invoke method...');
      ipcRenderer.invoke('get-settings')
        .then(settings => {
          console.log('[Test] Invoke successful, received settings:', settings);
          invokeSuccess = true;
        })
        .catch(err => {
          console.error('[Test] Invoke failed:', err);
        });
    } catch (e) {
      console.error('[Test] Exception during invoke test:', e);
      return {
        success: false,
        error: 'Exception during invoke test',
        details: { error: e.toString() }
      };
    }
    
    // Test on/removeAllListeners
    let listenerSuccess = false;
    try {
      console.log('[Test] Testing on/removeAllListeners methods...');
      
      // Add a test listener
      const listener = (status) => {
        console.log('[Test] Received recording status:', status);
      };
      
      ipcRenderer.on('recording-status', listener);
      console.log('[Test] Added listener for recording-status');
      
      // Remove the listener
      try {
        ipcRenderer.removeAllListeners('recording-status');
        console.log('[Test] Successfully removed all listeners for recording-status');
        listenerSuccess = true;
      } catch (e) {
        console.error('[Test] Error removing listeners:', e);
        return {
          success: false,
          error: 'Error removing listeners',
          details: { error: e.toString() }
        };
      }
    } catch (e) {
      console.error('[Test] Exception during on/removeAllListeners test:', e);
      return {
        success: false,
        error: 'Exception during on/removeAllListeners test',
        details: { error: e.toString() }
      };
    }
    
    console.log('[Test] IPC communication test completed successfully');
    return {
      success: true,
      details: {
        hasRemoveAllListeners,
        invokeSuccess,
        listenerSuccess
      }
    };
  } catch (e) {
    console.error('[Test] Unexpected error during test:', e);
    return {
      success: false,
      error: 'Unexpected error during test',
      details: { error: e.toString() }
    };
  }
};

// Export a function to run the test
export const runIpcTest = () => {
  console.log('[Test] Running IPC test...');
  const result = testIpcCommunication();
  console.log('[Test] IPC test result:', result);
  return result.success;
}; 