const { ipcMain, systemPreferences } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');
const record = require('node-record-lpcm16');

/**
 * Sets up all microphone-related IPC handlers
 */
function setupMicrophoneHandlers() {
  console.log('[MicrophoneHandlers] Setting up microphone handlers...');
  
  // Handle microphone selection
  ipcMain.handle('set-microphone', async (event, deviceId) => {
    console.log('[MicrophoneHandlers] set-microphone called with deviceId:', deviceId);
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
      console.error('[MicrophoneHandlers] Error setting microphone:', error);
      throw error;
    }
  });

  // Handle microphone enumeration
  ipcMain.handle('get-microphones', async (event) => {
    console.log('[MicrophoneHandlers] get-microphones called from renderer');
    console.log('[MicrophoneHandlers] Event sender:', event.sender.getURL());
    
    try {
      console.log('[MicrophoneHandlers] Enumerating audio devices...');
      
      // Check microphone permission on macOS
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        console.log('[MicrophoneHandlers] macOS microphone permission status:', status);
        
        if (status !== 'granted') {
          console.log('[MicrophoneHandlers] Requesting microphone permission...');
          const granted = await systemPreferences.askForMediaAccess('microphone');
          console.log('[MicrophoneHandlers] Permission request result:', granted);
          
          if (!granted) {
            console.error('[MicrophoneHandlers] Microphone permission denied by user');
            throw new Error('Microphone permission denied');
          }
        }
      }
      
      // SIMPLIFIED APPROACH: Just add the default microphone and test if it works
      let audioInputs = [{
        id: 'default',
        label: 'System Default Microphone',
        isDefault: true
      }];
      
      // Test if we can actually record with the default microphone
      try {
        console.log('[MicrophoneHandlers] Testing default microphone access...');
        
        // Create a test recorder
        const testRecorder = record.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'raw'
        });
        
        // Start recording for a very short time
        console.log('[MicrophoneHandlers] Starting test recording...');
        const stream = testRecorder.stream();
        
        // Wait for a short time to see if we get data
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[MicrophoneHandlers] Test recording timeout - no data received');
            resolve(false);
          }, 500);
          
          stream.once('data', () => {
            console.log('[MicrophoneHandlers] Successfully received audio data in test');
            clearTimeout(timeout);
            resolve(true);
          });
          
          stream.once('error', (err) => {
            console.error('[MicrophoneHandlers] Error during test recording:', err);
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        // Stop the test recorder
        console.log('[MicrophoneHandlers] Stopping test recording');
        testRecorder.stop();
        
        // Add a built-in microphone option
        audioInputs.push({
          id: 'built-in',
          label: 'Built-in Microphone',
          isDefault: false
        });
        
      } catch (error) {
        console.error('[MicrophoneHandlers] Error testing microphone access:', error);
        // We'll still return the default microphone option
      }
      
      console.log('[MicrophoneHandlers] Available microphones:', JSON.stringify(audioInputs, null, 2));
      
      return audioInputs;
    } catch (error) {
      console.error('[MicrophoneHandlers] Failed to enumerate microphones:', error);
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
    console.log('[MicrophoneHandlers] change-microphone called with deviceId:', deviceId);
    try {
      console.log('[MicrophoneHandlers] Changing microphone to:', deviceId);
      const recorder = serviceRegistry.get('recorder');
      const success = await recorder.setDevice(deviceId);
      return { success };
    } catch (error) {
      console.error('[MicrophoneHandlers] Failed to change microphone:', error);
      throw new Error('Failed to change microphone: ' + error.message);
    }
  });
  
  console.log('[MicrophoneHandlers] Microphone handlers setup complete');
}

module.exports = setupMicrophoneHandlers; 