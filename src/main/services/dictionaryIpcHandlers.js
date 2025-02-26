const { ipcMain } = require('electron');
const LogManager = require('../utils/LogManager');

// Get a logger for this module
const logger = LogManager.getLogger('DictionaryIpcHandlers');

// Define our channel names at module level
const CHANNELS = {
  GET_WORDS: 'get-dictionary-words',
  ADD_WORD: 'add-dictionary-word',
  REMOVE_WORD: 'remove-dictionary-word',
  GET_ACTION_VERBS: 'get-action-verbs',
  ADD_ACTION_VERB: 'add-action-verb',
  REMOVE_ACTION_VERB: 'remove-action-verb'
};

/**
 * Sets up all dictionary-related IPC handlers
 * @param {Object} serviceRegistry - The service registry instance
 */
function setupDictionaryIpcHandlers(serviceRegistry) {
  logger.info('Starting setup...');
  
  if (!serviceRegistry) {
    logger.error('ServiceRegistry not provided');
    throw new Error('ServiceRegistry is required');
  }
  
  const dictionaryService = serviceRegistry.get('dictionary');
  const configService = serviceRegistry.get('config');
  
  logger.info('Services retrieved', { 
    metadata: {
      ipcMainAvailable: !!ipcMain,
      handleMethodAvailable: typeof ipcMain?.handle === 'function',
      dictionaryServiceAvailable: !!dictionaryService,
      configServiceAvailable: !!configService
    }
  });
  
  if (dictionaryService) {
    logger.debug('DictionaryService methods available', {
      metadata: {
        getAllWords: typeof dictionaryService.getAllWords === 'function',
        addWord: typeof dictionaryService.addWord === 'function',
        removeWord: typeof dictionaryService.removeWord === 'function'
      }
    });
  }
  
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    logger.error('Critical: ipcMain or handle method not available');
    throw new Error('ipcMain not properly initialized');
  }

  // Log current state
  const currentHandlers = ipcMain.eventNames();
  logger.debug('Current handlers before setup:', { metadata: { handlers: currentHandlers } });

  // Remove existing handlers if any
  Object.values(CHANNELS).forEach(channel => {
    try {
      logger.debug(`Removing handler for ${channel}`);
      ipcMain.removeHandler(channel);
    } catch (error) {
      logger.warn(`Error removing handler for ${channel}:`, { metadata: { error } });
    }
  });

  try {
    // Register get-dictionary-words handler
    logger.debug(`Registering handler for ${CHANNELS.GET_WORDS}`);
    ipcMain.handle(CHANNELS.GET_WORDS, async () => {
      logger.debug('Handling get-dictionary-words request');
      try {
        if (!dictionaryService || typeof dictionaryService.getAllWords !== 'function') {
          logger.error('dictionaryService or getAllWords method not available');
          throw new Error('Dictionary service not properly initialized');
        }
        
        // Get words from the dictionary service
        const words = await dictionaryService.getAllWords();
        
        // Verify we got an array
        if (!Array.isArray(words)) {
          logger.error('getAllWords did not return an array:', { metadata: { words } });
          return [];
        }
        
        logger.debug('Retrieved words', { metadata: { count: words.length } });
        return words;
      } catch (error) {
        logger.error('Error getting dictionary words:', { metadata: { error } });
        // Return empty array instead of throwing to prevent UI errors
        return [];
      }
    });

    // Register add-dictionary-word handler
    logger.debug(`Registering handler for ${CHANNELS.ADD_WORD}`);
    ipcMain.handle(CHANNELS.ADD_WORD, async (event, word) => {
      logger.debug('Handling add-dictionary-word request:', { metadata: { word } });
      try {
        const result = await dictionaryService.addWord(word);
        logger.info('Word added successfully:', { metadata: { word } });
        return result;
      } catch (error) {
        logger.error('Error adding dictionary word:', { metadata: { error, word } });
        throw error;
      }
    });

    // Register remove-dictionary-word handler
    logger.debug(`Registering handler for ${CHANNELS.REMOVE_WORD}`);
    ipcMain.handle(CHANNELS.REMOVE_WORD, async (event, word) => {
      logger.debug('Handling remove-dictionary-word request:', { metadata: { word } });
      try {
        const result = await dictionaryService.removeWord(word);
        logger.info('Word removed successfully:', { metadata: { word } });
        return result;
      } catch (error) {
        logger.error('Error removing dictionary word:', { metadata: { error, word } });
        throw error;
      }
    });

    // Register get-action-verbs handler
    logger.debug(`Registering handler for ${CHANNELS.GET_ACTION_VERBS}`);
    ipcMain.handle(CHANNELS.GET_ACTION_VERBS, async () => {
      logger.debug('Handling get-action-verbs request');
      try {
        const verbs = await configService.getActionVerbs();
        logger.debug('Retrieved action verbs', { metadata: { count: verbs.length } });
        return verbs;
      } catch (error) {
        logger.error('Error getting action verbs:', { metadata: { error } });
        throw error;
      }
    });

    // Register add-action-verb handler
    logger.debug(`Registering handler for ${CHANNELS.ADD_ACTION_VERB}`);
    ipcMain.handle(CHANNELS.ADD_ACTION_VERB, async (event, verb) => {
      logger.debug('Handling add-action-verb request:', { metadata: { verb } });
      try {
        const result = await configService.addActionVerb(verb);
        logger.info('Action verb added successfully:', { metadata: { verb } });
        return result;
      } catch (error) {
        logger.error('Error adding action verb:', { metadata: { error, verb } });
        throw error;
      }
    });

    // Register remove-action-verb handler
    logger.debug(`Registering handler for ${CHANNELS.REMOVE_ACTION_VERB}`);
    ipcMain.handle(CHANNELS.REMOVE_ACTION_VERB, async (event, verb) => {
      logger.debug('Handling remove-action-verb request:', { metadata: { verb } });
      try {
        const result = await configService.removeActionVerb(verb);
        logger.info('Action verb removed successfully:', { metadata: { verb } });
        return result;
      } catch (error) {
        logger.error('Error removing action verb:', { metadata: { error, verb } });
        throw error;
      }
    });

    logger.info('Setup completed successfully');
  } catch (error) {
    logger.error('Critical error during setup:', { metadata: { error } });
    throw error;
  }
}

module.exports = setupDictionaryIpcHandlers; 