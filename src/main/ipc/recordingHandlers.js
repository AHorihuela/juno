const { ipcMain } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('RecordingHandlers');

/**
 * Sets up all recording-related IPC handlers
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupRecordingHandlers(serviceRegistry) {
  logger.info('Setting up recording handlers...');
  
  // Log available services for debugging
  logger.debug('Available services for recording:', { 
    metadata: { 
      services: Array.from(serviceRegistry.services.keys()) 
    } 
  });
  
  // Handle start recording request
  ipcMain.handle('start-recording', async () => {
    logger.info('start-recording called from renderer');
    try {
      // Log available services for debugging
      logger.debug('Available services:', { 
        metadata: { 
          services: Array.from(serviceRegistry.services.keys()) 
        } 
      });
      
      const recorder = serviceRegistry.get('recorder');
      logger.debug('Recorder service retrieved', { 
        metadata: { 
          isRecording: recorder.isRecording(),
          initialized: recorder.initialized
        } 
      });
      
      if (recorder.isRecording()) {
        logger.info('Already recording, ignoring start request');
        return { success: true, alreadyRecording: true };
      }
      
      logger.info('Starting recording...');
      
      // Check microphone access before starting
      try {
        logger.debug('Testing microphone access...');
        const micManager = recorder.micManager;
        if (micManager) {
          const micAccess = await micManager.testMicrophoneAccess();
          logger.debug('Microphone access test result:', { metadata: { micAccess } });
        } else {
          logger.warn('MicManager not available in recorder');
        }
      } catch (micError) {
        logger.error('Error testing microphone access:', { metadata: { error: micError } });
      }
      
      // Check available methods on recorder
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(recorder))
        .filter(name => typeof recorder[name] === 'function' && name !== 'constructor');
      
      logger.debug('Available recorder methods:', { metadata: { methods } });
      
      // Verify start method exists
      if (typeof recorder.start !== 'function') {
        logger.error('Recorder service missing start method');
        throw new Error('Recorder service missing start method');
      }
      
      await recorder.start();
      logger.info('Recording started successfully');
      return { success: true };
    } catch (error) {
      logger.error('Failed to start recording:', { metadata: { error } });
      throw new Error('Failed to start recording: ' + error.message);
    }
  });

  // Handle stop recording request
  ipcMain.handle('stop-recording', async () => {
    logger.info('stop-recording called from renderer');
    try {
      const recorder = serviceRegistry.get('recorder');
      logger.debug('Recorder service retrieved for stop', { 
        metadata: { 
          isRecording: recorder.isRecording(),
          initialized: recorder.initialized
        } 
      });
      
      if (!recorder.isRecording()) {
        logger.info('Not recording, ignoring stop request');
        return { success: true, notRecording: true };
      }
      
      logger.info('Stopping recording...');
      
      // Verify stop method exists
      if (typeof recorder.stop !== 'function') {
        logger.error('Recorder service missing stop method');
        throw new Error('Recorder service missing stop method');
      }
      
      await recorder.stop();
      logger.info('Recording stopped successfully');
      
      // Check transcription and insertion flow
      logger.debug('Recording stopped, waiting for transcription and text insertion events...');
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop recording:', { metadata: { error } });
      throw new Error('Failed to stop recording: ' + error.message);
    }
  });
  
  logger.info('Recording handlers setup complete');
}

module.exports = setupRecordingHandlers; 