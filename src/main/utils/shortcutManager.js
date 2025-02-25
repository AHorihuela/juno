const { globalShortcut } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

// Constants
const FN_DOUBLE_TAP_DELAY = 300; // ms

// State variables
let lastFnKeyPress = 0;
let fnKeyTimeout = null;

/**
 * Registers all global shortcuts for the application
 */
async function registerShortcuts() {
  console.log('Registering shortcuts...');
  
  // Get configured shortcut
  const shortcut = await serviceRegistry.get('config').getKeyboardShortcut();
  console.log('Using keyboard shortcut:', shortcut);
  
  // Register configured shortcut for toggle
  const success = globalShortcut.register(shortcut, () => {
    console.log('Shortcut triggered');
    const now = Date.now();
    
    if (now - lastFnKeyPress <= FN_DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('Double tap detected, starting recording');
      clearTimeout(fnKeyTimeout);
      const recorder = serviceRegistry.get('recorder');
      if (!recorder.isRecording()) {
        recorder.start();
      }
    } else {
      // Single tap - wait to see if it's a double tap
      console.log('Single tap detected, waiting for potential double tap');
      fnKeyTimeout = setTimeout(() => {
        const recorder = serviceRegistry.get('recorder');
        if (recorder.isRecording()) {
          console.log('Single tap timeout reached, stopping recording');
          recorder.stop();
        }
      }, FN_DOUBLE_TAP_DELAY);
    }
    
    lastFnKeyPress = now;
  });

  console.log('Keyboard shortcut registration success:', success);
  return success;
}

/**
 * Unregisters all global shortcuts
 */
function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
  console.log('All shortcuts unregistered');
}

module.exports = {
  registerShortcuts,
  unregisterAllShortcuts
}; 