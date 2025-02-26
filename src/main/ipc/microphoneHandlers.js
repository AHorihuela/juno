const { ipcMain, systemPreferences } = require('electron');
const record = require('node-record-lpcm16');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('MicrophoneHandlers');

/**
 * Sets up all microphone-related IPC handlers
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupMicrophoneHandlers(serviceRegistry) {
  logger.info('Setting up microphone handlers...');
  
  // Handle microphone selection
  ipcMain.handle('set-microphone', async (event, deviceId) => {
    logger.info('set-microphone called with deviceId:', { metadata: { deviceId } });
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
      logger.error('Error setting microphone:', { metadata: { error } });
      throw error;
    }
  });

  // Handle microphone enumeration
  ipcMain.handle('get-microphones', async (event) => {
    logger.info('get-microphones called from renderer');
    logger.info('Event sender:', event.sender.getURL());
    
    try {
      logger.info('Enumerating audio devices...');
      
      // Check microphone permission on macOS
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        logger.info('macOS microphone permission status:', status);
        
        if (status !== 'granted') {
          logger.info('Requesting microphone permission...');
          const granted = await systemPreferences.askForMediaAccess('microphone');
          logger.info('Permission request result:', granted);
          
          if (!granted) {
            logger.error('Microphone permission denied by user');
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
        logger.info('Testing default microphone access...');
        
        // Create a test recorder
        const testRecorder = record.record({
          sampleRate: 16000,
          channels: 1,
          audioType: 'raw'
        });
        
        // Start recording for a very short time
        logger.info('Starting test recording...');
        const stream = testRecorder.stream();
        
        // Wait for a short time to see if we get data
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            logger.info('Test recording timeout - no data received');
            resolve(false);
          }, 500);
          
          stream.once('data', () => {
            logger.info('Successfully received audio data in test');
            clearTimeout(timeout);
            resolve(true);
          });
          
          stream.once('error', (err) => {
            logger.error('Error during test recording:', err);
            clearTimeout(timeout);
            resolve(false);
          });
        });
        
        // Stop the test recorder
        logger.info('Stopping test recording');
        testRecorder.stop();
        
        // Add a built-in microphone option
        audioInputs.push({
          id: 'built-in',
          label: 'Built-in Microphone',
          isDefault: false
        });
        
      } catch (error) {
        logger.error('Error testing microphone access:', error);
        // We'll still return the default microphone option
      }
      
      logger.info('Available microphones:', JSON.stringify(audioInputs, null, 2));
      
      return audioInputs;
    } catch (error) {
      logger.error('Failed to enumerate microphones:', error);
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
    logger.info('change-microphone called with deviceId:', deviceId);
    try {
      logger.info('Changing microphone to:', deviceId);
      const recorder = serviceRegistry.get('recorder');
      const success = await recorder.setDevice(deviceId);
      return { success };
    } catch (error) {
      logger.error('Failed to change microphone:', error);
      throw new Error('Failed to change microphone: ' + error.message);
    }
  });
  
  logger.info('Microphone handlers setup complete');
}

module.exports = setupMicrophoneHandlers; 