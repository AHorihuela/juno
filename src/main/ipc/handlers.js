const { ipcMain, globalShortcut } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');

function setupIpcHandlers(mainWindow) {
  // Recording status handlers
  const recorder = serviceRegistry.get('recorder');
  const tray = serviceRegistry.get('tray');
  const overlay = serviceRegistry.get('overlay');
  
  recorder.on('start', () => {
    console.log('Recording started, registering Escape key');
    // Register Escape key when recording starts
    const escSuccess = globalShortcut.register('Escape', () => {
      console.log('Escape pressed, stopping recording');
      recorder.stop();
    });
    console.log('Escape key registration success:', escSuccess);
    
    // Only send status update if window exists, but don't activate it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-status', true);
    }
    tray.updateRecordingStatus(true);
    overlay.show();
  });

  recorder.on('stop', () => {
    console.log('Recording stopped, unregistering Escape key');
    // Unregister Escape key when recording stops
    globalShortcut.unregister('Escape');
    
    // Only send status update if window exists, but don't activate it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-status', false);
    }
    tray.updateRecordingStatus(false);
    overlay.hide();
  });

  recorder.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-error', error.message);
    }
  });

  recorder.on('transcription', (text) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription', text);
      // Add transcription to history
      try {
        const history = serviceRegistry.get('transcriptionHistory');
        history.addTranscription(text);
      } catch (error) {
        console.error('Failed to add transcription to history:', error);
      }
    }
  });

  // Transcription history handlers
  ipcMain.on('get-transcription-history', (event) => {
    try {
      const history = serviceRegistry.get('transcriptionHistory').getHistory();
      event.reply('transcription-history', history);
    } catch (error) {
      console.error('Failed to get transcription history:', error);
      event.reply('transcription-history-error', error.message);
    }
  });

  ipcMain.on('delete-transcription', (event, id) => {
    try {
      const history = serviceRegistry.get('transcriptionHistory');
      history.deleteTranscription(id);
      event.reply('transcription-history', history.getHistory());
    } catch (error) {
      console.error('Failed to delete transcription:', error);
      event.reply('transcription-history-error', error.message);
    }
  });

  ipcMain.on('clear-transcription-history', (event) => {
    try {
      const history = serviceRegistry.get('transcriptionHistory');
      history.clearHistory();
      event.reply('transcription-history', []);
    } catch (error) {
      console.error('Failed to clear transcription history:', error);
      event.reply('transcription-history-error', error.message);
    }
  });

  // Settings handlers
  ipcMain.handle('get-settings', async () => {
    console.log('Handling get-settings request...');
    try {
      const config = serviceRegistry.get('config');
      return {
        openaiApiKey: await config.getOpenAIApiKey(),
        aiTriggerWord: await config.getAITriggerWord(),
        aiModel: await config.getAIModel(),
        aiTemperature: await config.getAITemperature(),
        startupBehavior: await config.getStartupBehavior(),
        defaultMicrophone: await config.getDefaultMicrophone(),
        actionVerbs: await config.getActionVerbs(),
        aiRules: await config.getAIRules(),
        keyboardShortcut: await config.getKeyboardShortcut(),
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      throw new Error(`Failed to load settings: ${error.message}`);
    }
  });

  // Reset settings handler
  ipcMain.handle('reset-settings', async () => {
    console.log('Resetting settings to defaults...');
    try {
      await serviceRegistry.get('config').resetToDefaults();
      return { success: true };
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  });
}

module.exports = setupIpcHandlers; 