const { ipcMain } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

/**
 * Sets up all recording-related IPC handlers
 */
function setupRecordingHandlers() {
  console.log('[RecordingHandlers] Setting up recording handlers...');
  
  // Handle start recording request
  ipcMain.handle('start-recording', async () => {
    console.log('[RecordingHandlers] start-recording called from renderer');
    try {
      const recorder = serviceRegistry.get('recorder');
      if (recorder.isRecording()) {
        console.log('[RecordingHandlers] Already recording, ignoring start request');
        return { success: true, alreadyRecording: true };
      }
      
      console.log('[RecordingHandlers] Starting recording...');
      await recorder.start();
      return { success: true };
    } catch (error) {
      console.error('[RecordingHandlers] Failed to start recording:', error);
      throw new Error('Failed to start recording: ' + error.message);
    }
  });

  // Handle stop recording request
  ipcMain.handle('stop-recording', async () => {
    console.log('[RecordingHandlers] stop-recording called from renderer');
    try {
      const recorder = serviceRegistry.get('recorder');
      if (!recorder.isRecording()) {
        console.log('[RecordingHandlers] Not recording, ignoring stop request');
        return { success: true, notRecording: true };
      }
      
      console.log('[RecordingHandlers] Stopping recording...');
      await recorder.stop();
      return { success: true };
    } catch (error) {
      console.error('[RecordingHandlers] Failed to stop recording:', error);
      throw new Error('Failed to stop recording: ' + error.message);
    }
  });
  
  console.log('[RecordingHandlers] Recording handlers setup complete');
}

module.exports = setupRecordingHandlers; 