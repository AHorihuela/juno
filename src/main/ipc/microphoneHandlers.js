const { ipcMain } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

/**
 * Sets up all microphone-related IPC handlers
 */
function setupMicrophoneHandlers() {
  // Handle microphone selection
  ipcMain.handle('set-microphone', async (event, deviceId) => {
    try {
      // Update the recorder's device
      const success = await serviceRegistry.get('recorder').setDevice(deviceId);
      if (!success) {
        throw new Error('Failed to switch to selected microphone');
      }
      
      // Update the config
      await serviceRegistry.get('config').setDefaultMicrophone(deviceId);
      
      return { success: true };
    } catch (error) {
      console.error('Error setting microphone:', error);
      throw error;
    }
  });

  // Handle microphone enumeration
  ipcMain.handle('get-microphones', async () => {
    try {
      console.log('Enumerating audio devices...');
      
      // Use desktopCapturer to get audio sources - this is more reliable in Electron
      const { desktopCapturer } = require('electron');
      
      // Get audio sources from desktop capturer
      const sources = await desktopCapturer.getSources({ 
        types: ['audio'],
        thumbnailSize: { width: 0, height: 0 }
      });
      
      console.log('Desktop capturer audio sources:', sources);
      
      // Also try to get devices from the renderer as a fallback
      let rendererDevices = [];
      const mainWindow = serviceRegistry.get('windowManager').getMainWindow();
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          rendererDevices = await mainWindow.webContents.executeJavaScript(`
            (async () => {
              try {
                // Request microphone permission first
                await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Then enumerate devices
                const devices = await navigator.mediaDevices.enumerateDevices();
                return devices
                  .filter(device => device.kind === 'audioinput')
                  .map(device => ({
                    id: device.deviceId,
                    label: device.label || 'Microphone ' + (device.deviceId || ''),
                    isDefault: device.deviceId === 'default'
                  }));
              } catch (error) {
                console.error('Error enumerating devices in renderer:', error);
                return [];
              }
            })();
          `);
          console.log('Renderer audio devices:', rendererDevices);
        } catch (error) {
          console.error('Failed to get devices from renderer:', error);
        }
      }
      
      // Combine sources from desktopCapturer and renderer
      let audioInputs = [];
      
      // Add sources from desktopCapturer
      sources.forEach(source => {
        if (!audioInputs.some(device => device.id === source.id)) {
          audioInputs.push({
            id: source.id,
            label: source.name || 'Audio Source ' + source.id,
            isDefault: false
          });
        }
      });
      
      // Add sources from renderer
      rendererDevices.forEach(device => {
        if (!audioInputs.some(existing => existing.id === device.id)) {
          audioInputs.push(device);
        }
      });
      
      // Always ensure we have a default option
      if (!audioInputs.some(mic => mic.id === 'default')) {
        audioInputs.unshift({
          id: 'default',
          label: 'System Default',
          isDefault: true
        });
      }

      console.log('Combined available microphones:', audioInputs);
      return audioInputs;
    } catch (error) {
      console.error('Failed to enumerate microphones:', error);
      // Return at least the default microphone option instead of throwing
      return [{
        id: 'default',
        label: 'System Default',
        isDefault: true
      }];
    }
  });

  // Handle microphone change
  ipcMain.handle('change-microphone', async (_, deviceId) => {
    try {
      console.log('Changing microphone to:', deviceId);
      const recorder = serviceRegistry.get('recorder');
      const success = await recorder.setDevice(deviceId);
      return { success };
    } catch (error) {
      console.error('Failed to change microphone:', error);
      throw new Error('Failed to change microphone: ' + error.message);
    }
  });
}

module.exports = setupMicrophoneHandlers; 