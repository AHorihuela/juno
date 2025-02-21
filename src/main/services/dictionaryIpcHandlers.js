const { ipcMain } = require('electron');
const dictionaryService = require('./dictionaryService');

// Define our channel names at module level
const CHANNELS = {
  GET_WORDS: 'get-dictionary-words',
  ADD_WORD: 'add-dictionary-word',
  REMOVE_WORD: 'remove-dictionary-word'
};

function setupDictionaryIpcHandlers() {
  console.log('[DictionaryIpcHandlers] Starting setup...');
  console.log('[DictionaryIpcHandlers] ipcMain available:', !!ipcMain);
  console.log('[DictionaryIpcHandlers] handle method available:', typeof ipcMain?.handle === 'function');
  
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    console.error('[DictionaryIpcHandlers] Critical: ipcMain or handle method not available');
    throw new Error('ipcMain not properly initialized');
  }

  // Log current state
  const currentHandlers = ipcMain.eventNames();
  console.log('[DictionaryIpcHandlers] Current handlers before setup:', currentHandlers);

  // Remove existing handlers if any
  Object.values(CHANNELS).forEach(channel => {
    try {
      console.log(`[DictionaryIpcHandlers] Removing handler for ${channel}`);
      ipcMain.removeHandler(channel);
    } catch (error) {
      console.log(`[DictionaryIpcHandlers] Error removing handler for ${channel}:`, error);
    }
  });

  try {
    // Register get-dictionary-words handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.GET_WORDS}`);
    ipcMain.handle(CHANNELS.GET_WORDS, async () => {
      console.log('[DictionaryIpcHandlers] Handling get-dictionary-words request');
      try {
        const words = await dictionaryService.getAllWords();
        console.log('[DictionaryIpcHandlers] Retrieved words:', words);
        return words;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error getting dictionary words:', error);
        throw error;
      }
    });

    // Register add-dictionary-word handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.ADD_WORD}`);
    ipcMain.handle(CHANNELS.ADD_WORD, async (event, word) => {
      console.log('[DictionaryIpcHandlers] Handling add-dictionary-word request:', word);
      try {
        const result = await dictionaryService.addWord(word);
        console.log('[DictionaryIpcHandlers] Word added successfully:', word);
        return result;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error adding dictionary word:', error);
        throw error;
      }
    });

    // Register remove-dictionary-word handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.REMOVE_WORD}`);
    ipcMain.handle(CHANNELS.REMOVE_WORD, async (event, word) => {
      console.log('[DictionaryIpcHandlers] Handling remove-dictionary-word request:', word);
      try {
        const result = await dictionaryService.removeWord(word);
        console.log('[DictionaryIpcHandlers] Word removed successfully:', word);
        return result;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error removing dictionary word:', error);
        throw error;
      }
    });

    // Verify registration
    const registeredHandlers = ipcMain.eventNames();
    console.log('[DictionaryIpcHandlers] Registered handlers after setup:', registeredHandlers);
    
    // Verify each handler specifically
    Object.values(CHANNELS).forEach(channel => {
      const isRegistered = registeredHandlers.includes(channel);
      console.log(`[DictionaryIpcHandlers] Handler ${channel} registered:`, isRegistered);
      if (!isRegistered) {
        throw new Error(`Failed to register handler for ${channel}`);
      }
    });

    console.log('[DictionaryIpcHandlers] Setup completed successfully');
  } catch (error) {
    console.error('[DictionaryIpcHandlers] Critical error during setup:', error);
    throw error;
  }
}

module.exports = setupDictionaryIpcHandlers; 