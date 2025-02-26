const { ipcMain, globalShortcut } = require('electron');
const serviceRegistry = require('../services/ServiceRegistry');
const { normalizeShortcut } = require('../utils/shortcutManager');

function setupIpcHandlers(mainWindow) {
  // Recording status handlers
  const recorder = serviceRegistry.get('recorder');
  const tray = serviceRegistry.get('tray');
  const windowManager = serviceRegistry.get('windowManager');
  
  let escapeRegistered = false;

  ipcMain.on('recording-started', () => {
    if (!escapeRegistered) {
      try {
        globalShortcut.register(normalizeShortcut('Escape'), () => {
          const recorder = serviceRegistry.get('recorder');
          if (recorder.isRecording()) {
            recorder.stop();
          }
        });
        escapeRegistered = true;
      } catch (error) {
        console.error('[IPC] Error registering Escape shortcut:', error);
      }
    }
  });

  ipcMain.on('recording-stopped', () => {
    if (escapeRegistered) {
      globalShortcut.unregister(normalizeShortcut('Escape'));
      escapeRegistered = false;
    }
  });

  recorder.on('start', () => {
    console.log('Recording started, registering Escape key');
    // Register Escape key when recording starts
    const escSuccess = globalShortcut.register(normalizeShortcut('Escape'), () => {
      console.log('Escape pressed, stopping recording');
      recorder.stop();
    });
    console.log('Escape key registration success:', escSuccess);
    
    // Only send status update if window exists, but don't activate it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-status', true);
    }
    tray.updateRecordingStatus(true);
    windowManager.showOverlay();
  });

  recorder.on('stop', () => {
    console.log('Recording stopped, unregistering Escape key');
    // Unregister Escape key when recording stops
    globalShortcut.unregister(normalizeShortcut('Escape'));
    
    // Only send status update if window exists, but don't activate it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-status', false);
    }
    tray.updateRecordingStatus(false);
    windowManager.hideOverlay();
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
  
  // Memory Manager handlers
  ipcMain.handle('context:getMemoryStats', async () => {
    try {
      console.log('Getting memory stats...');
      const contextService = serviceRegistry.get('context');
      return contextService.getMemoryStats();
    } catch (error) {
      console.error('Error getting memory stats:', error);
      throw new Error(`Failed to get memory stats: ${error.message}`);
    }
  });
  
  ipcMain.handle('memory:deleteItem', async (event, itemId) => {
    try {
      console.log('Deleting memory item:', itemId);
      const memoryManager = serviceRegistry.get('memoryManager');
      const success = await memoryManager.deleteItem(itemId);
      return { success };
    } catch (error) {
      console.error('Error deleting memory item:', error);
      throw new Error(`Failed to delete memory item: ${error.message}`);
    }
  });
  
  ipcMain.handle('memory:clearMemory', async (event, tier) => {
    try {
      console.log('Clearing all memory');
      const memoryManager = serviceRegistry.get('memoryManager');
      
      // SimpleMemoryManager only has clearAllMemory, no tiers
      const success = await memoryManager.clearAllMemory();
      
      return { success };
    } catch (error) {
      console.error('Error clearing memory:', error);
      throw new Error(`Failed to clear memory: ${error.message}`);
    }
  });
  
  ipcMain.handle('memory:getStats', async () => {
    try {
      console.log('Getting memory manager stats...');
      const memoryManager = serviceRegistry.get('memoryManager');
      return memoryManager.getMemoryStats();
    } catch (error) {
      console.error('Error getting memory manager stats:', error);
      throw new Error(`Failed to get memory manager stats: ${error.message}`);
    }
  });
  
  ipcMain.handle('ai:getStats', async () => {
    try {
      console.log('Getting AI usage stats...');
      const aiService = serviceRegistry.get('ai');
      return aiService.getAIUsageStats();
    } catch (error) {
      console.error('Error getting AI usage stats:', error);
      throw new Error(`Failed to get AI usage stats: ${error.message}`);
    }
  });
}

module.exports = setupIpcHandlers; 