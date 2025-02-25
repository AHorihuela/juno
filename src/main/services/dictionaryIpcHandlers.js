const { ipcMain } = require('electron');
const dictionaryServiceFactory = require('./dictionaryService');
const dictionaryService = dictionaryServiceFactory();
const configServiceFactory = require('./configService');
const configService = configServiceFactory();

// Define our channel names at module level
const CHANNELS = {
  GET_WORDS: 'get-dictionary-words',
  ADD_WORD: 'add-dictionary-word',
  REMOVE_WORD: 'remove-dictionary-word',
  GET_ACTION_VERBS: 'get-action-verbs',
  ADD_ACTION_VERB: 'add-action-verb',
  REMOVE_ACTION_VERB: 'remove-action-verb'
};

function setupDictionaryIpcHandlers() {
  console.log('[DictionaryIpcHandlers] Starting setup...');
  console.log('[DictionaryIpcHandlers] ipcMain available:', !!ipcMain);
  console.log('[DictionaryIpcHandlers] handle method available:', typeof ipcMain?.handle === 'function');
  console.log('[DictionaryIpcHandlers] dictionaryService available:', !!dictionaryService);
  
  if (dictionaryService) {
    console.log('[DictionaryIpcHandlers] dictionaryService methods:', {
      getAllWords: typeof dictionaryService.getAllWords === 'function',
      addWord: typeof dictionaryService.addWord === 'function',
      removeWord: typeof dictionaryService.removeWord === 'function'
    });
  }
  
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
        if (!dictionaryService || typeof dictionaryService.getAllWords !== 'function') {
          console.error('[DictionaryIpcHandlers] dictionaryService or getAllWords method not available');
          throw new Error('Dictionary service not properly initialized');
        }
        
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

    // Register get-action-verbs handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.GET_ACTION_VERBS}`);
    ipcMain.handle(CHANNELS.GET_ACTION_VERBS, async () => {
      console.log('[DictionaryIpcHandlers] Handling get-action-verbs request');
      try {
        const verbs = await configService.getActionVerbs();
        console.log('[DictionaryIpcHandlers] Retrieved action verbs:', verbs);
        return verbs;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error getting action verbs:', error);
        throw error;
      }
    });

    // Register add-action-verb handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.ADD_ACTION_VERB}`);
    ipcMain.handle(CHANNELS.ADD_ACTION_VERB, async (event, verb) => {
      console.log('[DictionaryIpcHandlers] Handling add-action-verb request:', verb);
      try {
        const result = await configService.addActionVerb(verb);
        console.log('[DictionaryIpcHandlers] Action verb added successfully:', verb);
        return result;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error adding action verb:', error);
        throw error;
      }
    });

    // Register remove-action-verb handler
    console.log(`[DictionaryIpcHandlers] Registering handler for ${CHANNELS.REMOVE_ACTION_VERB}`);
    ipcMain.handle(CHANNELS.REMOVE_ACTION_VERB, async (event, verb) => {
      console.log('[DictionaryIpcHandlers] Handling remove-action-verb request:', verb);
      try {
        const result = await configService.removeActionVerb(verb);
        console.log('[DictionaryIpcHandlers] Action verb removed successfully:', verb);
        return result;
      } catch (error) {
        console.error('[DictionaryIpcHandlers] Error removing action verb:', error);
        throw error;
      }
    });

    console.log('[DictionaryIpcHandlers] Setup completed successfully');
  } catch (error) {
    console.error('[DictionaryIpcHandlers] Critical error during setup:', error);
    throw error;
  }
}

module.exports = setupDictionaryIpcHandlers; 